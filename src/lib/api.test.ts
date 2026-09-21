import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gql, onAuthRequired, rest } from "./api";
import { AuthRequired, GraphQLRefusal, InvalidCredentials, NetworkError, RateLimited, RequestRejected } from "./errors";
import { graphql } from "../gql";

describe("api client", () => {
  const fetchMock = vi.fn();
  const meDoc = graphql(`query Me { me { id emailAddress } }`);

  function reply(status: number, body: unknown) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" }
    }));
  }

  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the maintenance header and credentials on every call, REST and GraphQL", async () => {
    reply(200, { id: "1" });
    reply(200, { data: { me: { id: "1", emailAddress: "a@b" } } });

    await rest("GET", "/session");
    await gql(meDoc);

    for (const [ , init ] of fetchMock.mock.calls) {
      expect(new Headers(init.headers).get("X-Rota-Maintenance")).toBe("1");
      expect(init.credentials).toBe("include");
    }
  });

  it("never puts the body in the URL", async () => {
    reply(200, {});
    await rest("POST", "/invitations/enroll", { token: "tok-secreto" });

    const [ url, init ] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/invitations/enroll");
    expect(String(url)).not.toContain("tok-secreto");
    expect(JSON.parse(init.body)).toEqual({ token: "tok-secreto" });
  });

  it("turns 401 into AuthRequired and tells the listener", async () => {
    const listener = vi.fn();
    const off = onAuthRequired(listener);
    reply(401, { error: "unauthenticated" });

    await expect(gql(meDoc)).rejects.toBeInstanceOf(AuthRequired);
    expect(listener).toHaveBeenCalledOnce();
    off();
  });

  it("turns invalid_credentials and invalid_session into InvalidCredentials, not AuthRequired", async () => {
    const listener = vi.fn();
    const off = onAuthRequired(listener);
    reply(401, { error: "invalid_credentials" });
    reply(401, { error: "invalid_session" });

    await expect(rest("POST", "/session", {})).rejects.toBeInstanceOf(InvalidCredentials);
    await expect(rest("POST", "/session/challenge", {})).rejects.toBeInstanceOf(InvalidCredentials);
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it("turns 429 into RateLimited and other REST errors into RequestRejected with the code", async () => {
    reply(429, { error: "too_many_requests" });
    reply(422, { error: "weak_password" });

    await expect(rest("POST", "/session", {})).rejects.toBeInstanceOf(RateLimited);
    await expect(rest("POST", "/invitations/accept", {})).rejects.toMatchObject({ code: "weak_password" });
  });

  it("turns a network failure into NetworkError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(rest("GET", "/session")).rejects.toBeInstanceOf(NetworkError);
  });

  it("throws a refusal when GraphQL answers no data, with its code", async () => {
    reply(200, { data: null, errors: [ { message: "teto", extensions: { code: "CITY_BUDGET_EXCEEDED" } } ] });
    await expect(gql(meDoc)).rejects.toMatchObject({ code: "CITY_BUDGET_EXCEEDED" });
  });

  it("returns partial data with field errors instead of throwing", async () => {
    reply(200, {
      data: { me: { id: "1", emailAddress: "a@b" } },
      errors: [ { message: "fora", path: [ "city", "profile" ], extensions: { code: "CITY_UNREACHABLE" } } ]
    });

    const result = await gql(meDoc);

    expect(result.data?.me.id).toBe("1");
    expect(result.fieldErrors).toHaveLength(1);
    expect(result.fieldErrors[0]).toBeInstanceOf(GraphQLRefusal);
    expect(result.fieldErrors[0]).toMatchObject({ code: "CITY_UNREACHABLE", path: [ "city", "profile" ] });
  });

  it("never exposes RequestRejected for a 401", async () => {
    reply(401, { error: "unauthenticated" });
    await expect(rest("GET", "/session")).rejects.not.toBeInstanceOf(RequestRejected);
  });
});
