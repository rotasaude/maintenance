/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "query Me { me { id emailAddress } }": typeof types.MeDocument,
    "\n  query Cities($status: CityStatus) {\n    cities(status: $status) { slug name uf status schemaVersion schemaBehind createdAt }\n  }\n": typeof types.CitiesDocument,
    "\n  query CityHeader($slug: String!) {\n    city(slug: $slug) {\n      slug name uf status schemaVersion schemaBehind createdAt\n      channel { phoneNumberId wabaId displayPhoneNumber active }\n    }\n  }\n": typeof types.CityHeaderDocument,
    "\n  query CityProfile($slug: String!) { city(slug: $slug) { slug consentTermVersion profile { name uf ibgeCode } } }\n": typeof types.CityProfileDocument,
    "\n  query CityProtocols($slug: String!) { city(slug: $slug) { slug protocols { name version status } } }\n": typeof types.CityProtocolsDocument,
    "\n  query CityRecipients($slug: String!) {\n    city(slug: $slug) { slug alertRecipients { channel destination escalationOrder } }\n  }\n": typeof types.CityRecipientsDocument,
    "\n  query CityAccounts($slug: String!) { city(slug: $slug) { slug accounts { login roles active mfaEnrolled } } }\n": typeof types.CityAccountsDocument,
    "\n  query CityCounts($slug: String!) {\n    city(slug: $slug) { slug counts { users conversations triages inboundMessages reportSnapshots consents } }\n  }\n": typeof types.CityCountsDocument,
    "\n  query CityOperations($slug: String!) {\n    city(slug: $slug) {\n      slug\n      operations {\n        domainEvents { name occurredAt publishedAt }\n        reportSnapshots { id createdAt expiresAt }\n        dashboardMetrics { dimension period label value computedAt }\n        failedJobs { className failedAt errorClass }\n      }\n    }\n  }\n": typeof types.CityOperationsDocument,
    "\n  query Maintainers { maintainers { id emailAddress active enrolled createdAt } }\n": typeof types.MaintainersDocument,
    "\n  mutation InviteMaintainer($emailAddress: String!, $code: String!) {\n    inviteMaintainer(emailAddress: $emailAddress, code: $code) { ok errors { path message } }\n  }\n": typeof types.InviteMaintainerDocument,
    "\n  mutation DeactivateMaintainer($id: ID!) { deactivateMaintainer(id: $id) { ok errors { path message } } }\n": typeof types.DeactivateMaintainerDocument,
};
const documents: Documents = {
    "query Me { me { id emailAddress } }": types.MeDocument,
    "\n  query Cities($status: CityStatus) {\n    cities(status: $status) { slug name uf status schemaVersion schemaBehind createdAt }\n  }\n": types.CitiesDocument,
    "\n  query CityHeader($slug: String!) {\n    city(slug: $slug) {\n      slug name uf status schemaVersion schemaBehind createdAt\n      channel { phoneNumberId wabaId displayPhoneNumber active }\n    }\n  }\n": types.CityHeaderDocument,
    "\n  query CityProfile($slug: String!) { city(slug: $slug) { slug consentTermVersion profile { name uf ibgeCode } } }\n": types.CityProfileDocument,
    "\n  query CityProtocols($slug: String!) { city(slug: $slug) { slug protocols { name version status } } }\n": types.CityProtocolsDocument,
    "\n  query CityRecipients($slug: String!) {\n    city(slug: $slug) { slug alertRecipients { channel destination escalationOrder } }\n  }\n": types.CityRecipientsDocument,
    "\n  query CityAccounts($slug: String!) { city(slug: $slug) { slug accounts { login roles active mfaEnrolled } } }\n": types.CityAccountsDocument,
    "\n  query CityCounts($slug: String!) {\n    city(slug: $slug) { slug counts { users conversations triages inboundMessages reportSnapshots consents } }\n  }\n": types.CityCountsDocument,
    "\n  query CityOperations($slug: String!) {\n    city(slug: $slug) {\n      slug\n      operations {\n        domainEvents { name occurredAt publishedAt }\n        reportSnapshots { id createdAt expiresAt }\n        dashboardMetrics { dimension period label value computedAt }\n        failedJobs { className failedAt errorClass }\n      }\n    }\n  }\n": types.CityOperationsDocument,
    "\n  query Maintainers { maintainers { id emailAddress active enrolled createdAt } }\n": types.MaintainersDocument,
    "\n  mutation InviteMaintainer($emailAddress: String!, $code: String!) {\n    inviteMaintainer(emailAddress: $emailAddress, code: $code) { ok errors { path message } }\n  }\n": types.InviteMaintainerDocument,
    "\n  mutation DeactivateMaintainer($id: ID!) { deactivateMaintainer(id: $id) { ok errors { path message } } }\n": types.DeactivateMaintainerDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "query Me { me { id emailAddress } }"): (typeof documents)["query Me { me { id emailAddress } }"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Cities($status: CityStatus) {\n    cities(status: $status) { slug name uf status schemaVersion schemaBehind createdAt }\n  }\n"): (typeof documents)["\n  query Cities($status: CityStatus) {\n    cities(status: $status) { slug name uf status schemaVersion schemaBehind createdAt }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CityHeader($slug: String!) {\n    city(slug: $slug) {\n      slug name uf status schemaVersion schemaBehind createdAt\n      channel { phoneNumberId wabaId displayPhoneNumber active }\n    }\n  }\n"): (typeof documents)["\n  query CityHeader($slug: String!) {\n    city(slug: $slug) {\n      slug name uf status schemaVersion schemaBehind createdAt\n      channel { phoneNumberId wabaId displayPhoneNumber active }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CityProfile($slug: String!) { city(slug: $slug) { slug consentTermVersion profile { name uf ibgeCode } } }\n"): (typeof documents)["\n  query CityProfile($slug: String!) { city(slug: $slug) { slug consentTermVersion profile { name uf ibgeCode } } }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CityProtocols($slug: String!) { city(slug: $slug) { slug protocols { name version status } } }\n"): (typeof documents)["\n  query CityProtocols($slug: String!) { city(slug: $slug) { slug protocols { name version status } } }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CityRecipients($slug: String!) {\n    city(slug: $slug) { slug alertRecipients { channel destination escalationOrder } }\n  }\n"): (typeof documents)["\n  query CityRecipients($slug: String!) {\n    city(slug: $slug) { slug alertRecipients { channel destination escalationOrder } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CityAccounts($slug: String!) { city(slug: $slug) { slug accounts { login roles active mfaEnrolled } } }\n"): (typeof documents)["\n  query CityAccounts($slug: String!) { city(slug: $slug) { slug accounts { login roles active mfaEnrolled } } }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CityCounts($slug: String!) {\n    city(slug: $slug) { slug counts { users conversations triages inboundMessages reportSnapshots consents } }\n  }\n"): (typeof documents)["\n  query CityCounts($slug: String!) {\n    city(slug: $slug) { slug counts { users conversations triages inboundMessages reportSnapshots consents } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CityOperations($slug: String!) {\n    city(slug: $slug) {\n      slug\n      operations {\n        domainEvents { name occurredAt publishedAt }\n        reportSnapshots { id createdAt expiresAt }\n        dashboardMetrics { dimension period label value computedAt }\n        failedJobs { className failedAt errorClass }\n      }\n    }\n  }\n"): (typeof documents)["\n  query CityOperations($slug: String!) {\n    city(slug: $slug) {\n      slug\n      operations {\n        domainEvents { name occurredAt publishedAt }\n        reportSnapshots { id createdAt expiresAt }\n        dashboardMetrics { dimension period label value computedAt }\n        failedJobs { className failedAt errorClass }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Maintainers { maintainers { id emailAddress active enrolled createdAt } }\n"): (typeof documents)["\n  query Maintainers { maintainers { id emailAddress active enrolled createdAt } }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InviteMaintainer($emailAddress: String!, $code: String!) {\n    inviteMaintainer(emailAddress: $emailAddress, code: $code) { ok errors { path message } }\n  }\n"): (typeof documents)["\n  mutation InviteMaintainer($emailAddress: String!, $code: String!) {\n    inviteMaintainer(emailAddress: $emailAddress, code: $code) { ok errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeactivateMaintainer($id: ID!) { deactivateMaintainer(id: $id) { ok errors { path message } } }\n"): (typeof documents)["\n  mutation DeactivateMaintainer($id: ID!) { deactivateMaintainer(id: $id) { ok errors { path message } } }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;