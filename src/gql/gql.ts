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
    "\n  query CityAnalyticsStatus($slug: String!) {\n    city(slug: $slug) {\n      slug\n      analyticsStatus { lastRunStatus lastSucceededAt lastPublishedAt lastError stale }\n    }\n  }\n": typeof types.CityAnalyticsStatusDocument,
    "\n  query CityAnalyticsIndicators($slug: String!, $from: ISO8601Date!, $to: ISO8601Date!) {\n    city(slug: $slug) {\n      slug\n      analyticsIndicators(from: $from, to: $to) { weekStart indicator value suppressed }\n    }\n  }\n": typeof types.CityAnalyticsIndicatorsDocument,
    "\n  query Maintainers { maintainers { id emailAddress active enrolled createdAt } }\n": typeof types.MaintainersDocument,
    "\n  query AuditEvents($since: ISO8601DateTime, $until: ISO8601DateTime, $maintainerId: ID, $module: String, $outcome: String, $limit: Int) {\n    auditEvents(since: $since, until: $until, maintainerId: $maintainerId, module: $module, outcome: $outcome, limit: $limit) {\n      name module outcome occurredAt maintainerId login correlationId\n    }\n  }\n": typeof types.AuditEventsDocument,
    "\n  query CareLineTemplates {\n    careLineTemplates { key version current name indicator declaredCondition eligibility practices createdAt createdBy }\n  }\n": typeof types.CareLineTemplatesDocument,
    "\n  mutation UpsertCareLineTemplate(\n    $key: String!, $name: String!, $indicator: String!, $declaredCondition: String, $eligibility: JSON!, $practices: JSON!\n  ) {\n    upsertCareLineTemplate(key: $key, name: $name, indicator: $indicator, declaredCondition: $declaredCondition,\n      eligibility: $eligibility, practices: $practices) {\n      ok errors { path message }\n    }\n  }\n": typeof types.UpsertCareLineTemplateDocument,
    "\n  query Cities($status: CityStatus) {\n    cities(status: $status) { slug name uf status schemaVersion schemaBehind createdAt }\n  }\n": typeof types.CitiesDocument,
    "\n  query CityHeader($slug: String!) {\n    city(slug: $slug) {\n      slug name uf status schemaVersion schemaBehind createdAt\n      channel { phoneNumberId wabaId displayPhoneNumber active }\n    }\n  }\n": typeof types.CityHeaderDocument,
    "\n  query CityProfile($slug: String!) { city(slug: $slug) { slug consentTermVersion profile { name uf ibgeCode } } }\n": typeof types.CityProfileDocument,
    "\n  query CityRecipients($slug: String!) {\n    city(slug: $slug) { slug alertRecipients { channel destination escalationOrder } }\n  }\n": typeof types.CityRecipientsDocument,
    "\n  query CityAccounts($slug: String!) { city(slug: $slug) { slug accounts { login roles active mfaEnrolled } } }\n": typeof types.CityAccountsDocument,
    "\n  query CityCounts($slug: String!) {\n    city(slug: $slug) { slug counts { users conversations triages inboundMessages reportSnapshots consents } }\n  }\n": typeof types.CityCountsDocument,
    "\n  query CityOperations($slug: String!) {\n    city(slug: $slug) {\n      slug\n      operations {\n        domainEvents { name occurredAt publishedAt }\n        reportSnapshots { id createdAt expiresAt }\n        dashboardMetrics { dimension period label value computedAt }\n        failedJobs { className failedAt errorClass }\n      }\n    }\n  }\n": typeof types.CityOperationsDocument,
    "\n  query CityFeatures($slug: String!) {\n    city(slug: $slug) {\n      slug\n      recordMode\n      profile { ibgeCode }\n      features { key description enabled usable missing changedAt changedBy }\n    }\n  }\n": typeof types.CityFeaturesDocument,
    "\n  mutation SetCityFeature($citySlug: String!, $key: String!, $enabled: Boolean!) {\n    setCityFeature(citySlug: $citySlug, key: $key, enabled: $enabled) {\n      ok\n      errors { path message }\n      feature { key description enabled usable missing changedAt changedBy }\n    }\n  }\n": typeof types.SetCityFeatureDocument,
    "\n  mutation UpsertLabAnalyteTemplate(\n    $id: ID, $labExamTemplateId: ID!, $key: String!, $name: String!, $loinc: String, $unit: String,\n    $valueType: String!, $choices: [String!], $decimals: Int!, $position: Int!, $referenceRanges: [LabReferenceRangeInput!]!\n  ) {\n    upsertLabAnalyteTemplate(\n      id: $id, labExamTemplateId: $labExamTemplateId, key: $key, name: $name, loinc: $loinc, unit: $unit,\n      valueType: $valueType, choices: $choices, decimals: $decimals, position: $position, referenceRanges: $referenceRanges\n    ) { ok errors { path message } }\n  }\n": typeof types.UpsertLabAnalyteTemplateDocument,
    "\n  query LabExamTemplates {\n    labExamTemplates {\n      id sigtapCode name sector material container suggestedMethod preparation active\n      analytes {\n        id key name loinc unit valueType choices decimals position\n        referenceRanges { sex ageMinDays ageMaxDays low high text }\n      }\n    }\n  }\n": typeof types.LabExamTemplatesDocument,
    "\n  mutation UpsertLabExamTemplate(\n    $id: ID, $sigtapCode: String!, $name: String!, $sector: String!, $material: String!, $container: String!,\n    $suggestedMethod: String, $preparation: String, $active: Boolean!\n  ) {\n    upsertLabExamTemplate(\n      id: $id, sigtapCode: $sigtapCode, name: $name, sector: $sector, material: $material, container: $container,\n      suggestedMethod: $suggestedMethod, preparation: $preparation, active: $active\n    ) { ok errors { path message } }\n  }\n": typeof types.UpsertLabExamTemplateDocument,
    "\n  mutation InviteMaintainer($emailAddress: String!, $code: String!) {\n    inviteMaintainer(emailAddress: $emailAddress, code: $code) { ok errors { path message } }\n  }\n": typeof types.InviteMaintainerDocument,
    "\n  mutation DeactivateMaintainer($id: ID!) { deactivateMaintainer(id: $id) { ok errors { path message } } }\n": typeof types.DeactivateMaintainerDocument,
    "\n  query MedicationCatalog($first: Int!) {\n    medicationCatalog {\n      currentRelease { id importedAt itemsCount hiddenCount }\n      reviewItems(first: $first) { catmatCode sourceDescription parseStatus }\n    }\n  }\n": typeof types.MedicationCatalogDocument,
    "\n  mutation ImportMedicationCatalog {\n    importMedicationCatalog { ok releaseId added changed removed errors { path message } }\n  }\n": typeof types.ImportMedicationCatalogDocument,
    "\n  mutation ImportAnvisaLists {\n    importAnvisaLists { ok antimicrobials controlled errors { path message } }\n  }\n": typeof types.ImportAnvisaListsDocument,
    "\n  query CityPecConfig($slug: String!) {\n    cityPecConfig(citySlug: $slug) { pecOrigin hmacKeyConfigured hmacKeyUpdatedAt }\n  }\n": typeof types.CityPecConfigDocument,
    "\n  mutation SetCityPecOrigin($citySlug: String!, $pecOrigin: String) {\n    setCityPecOrigin(citySlug: $citySlug, pecOrigin: $pecOrigin) { ok errors { path message } }\n  }\n": typeof types.SetCityPecOriginDocument,
    "\n  mutation RotateCityPecHmacKey($citySlug: String!, $key: String!, $code: String!) {\n    rotateCityPecHmacKey(citySlug: $citySlug, key: $key, code: $code) { ok errors { path message } }\n  }\n": typeof types.RotateCityPecHmacKeyDocument,
    "\n  query CityProtocolVersions($slug: String!) {\n    city(slug: $slug) {\n      slug\n      protocolVersions {\n        name version status\n        publicationSignatures publicationMissing\n        activationSignatures activationMissing\n        eligibleReviewers revertible revertTargetVersion\n      }\n    }\n  }\n": typeof types.CityProtocolVersionsDocument,
    "\n  mutation SubmitProtocolForReview($citySlug: String!, $name: String!, $version: Int!) {\n    submitProtocolForReview(citySlug: $citySlug, name: $name, version: $version) { ok errors { path message } }\n  }\n": typeof types.SubmitProtocolForReviewDocument,
    "\n  mutation PublishProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    publishProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n": typeof types.PublishProtocolDocument,
    "\n  mutation ActivateProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    activateProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n": typeof types.ActivateProtocolDocument,
    "\n  mutation RetireProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    retireProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n": typeof types.RetireProtocolDocument,
    "\n  mutation RevertProtocolActivation($citySlug: String!, $name: String!, $reason: String!, $code: String!, $expectedVersion: Int) {\n    revertProtocolActivation(citySlug: $citySlug, name: $name, reason: $reason, code: $code, expectedVersion: $expectedVersion) {\n      ok\n      revertedToVersion\n      errors { path message }\n    }\n  }\n": typeof types.RevertProtocolActivationDocument,
    "\n  query SignaturePlatform {\n    signatureProviders { key configured lastCheckAt lastCheckOk }\n    signerStatus { reachable version crlUpdatedAt }\n  }\n": typeof types.SignaturePlatformDocument,
    "\n  query SncrPlatform {\n    sncrStatus { configured reachable lastCheckAt simulatedAvailable }\n  }\n": typeof types.SncrPlatformDocument,
    "\n  query MaintenanceTokens {\n    maintenanceTokens { id name access citySlugs expiresAt revokedAt lastUsedAt }\n  }\n": typeof types.MaintenanceTokensDocument,
    "\n  query CitiesForTokenScope { cities { slug name } }\n": typeof types.CitiesForTokenScopeDocument,
    "\n  mutation CreateMaintenanceToken($name: String!, $access: String!, $citySlugs: [String!], $expiresAt: ISO8601DateTime!, $code: String!) {\n    createMaintenanceToken(name: $name, access: $access, citySlugs: $citySlugs, expiresAt: $expiresAt, code: $code) {\n      ok secretOnce errors { path message }\n    }\n  }\n": typeof types.CreateMaintenanceTokenDocument,
    "\n  mutation RevokeMaintenanceToken($id: ID!) { revokeMaintenanceToken(id: $id) { ok errors { path message } } }\n": typeof types.RevokeMaintenanceTokenDocument,
};
const documents: Documents = {
    "query Me { me { id emailAddress } }": types.MeDocument,
    "\n  query CityAnalyticsStatus($slug: String!) {\n    city(slug: $slug) {\n      slug\n      analyticsStatus { lastRunStatus lastSucceededAt lastPublishedAt lastError stale }\n    }\n  }\n": types.CityAnalyticsStatusDocument,
    "\n  query CityAnalyticsIndicators($slug: String!, $from: ISO8601Date!, $to: ISO8601Date!) {\n    city(slug: $slug) {\n      slug\n      analyticsIndicators(from: $from, to: $to) { weekStart indicator value suppressed }\n    }\n  }\n": types.CityAnalyticsIndicatorsDocument,
    "\n  query Maintainers { maintainers { id emailAddress active enrolled createdAt } }\n": types.MaintainersDocument,
    "\n  query AuditEvents($since: ISO8601DateTime, $until: ISO8601DateTime, $maintainerId: ID, $module: String, $outcome: String, $limit: Int) {\n    auditEvents(since: $since, until: $until, maintainerId: $maintainerId, module: $module, outcome: $outcome, limit: $limit) {\n      name module outcome occurredAt maintainerId login correlationId\n    }\n  }\n": types.AuditEventsDocument,
    "\n  query CareLineTemplates {\n    careLineTemplates { key version current name indicator declaredCondition eligibility practices createdAt createdBy }\n  }\n": types.CareLineTemplatesDocument,
    "\n  mutation UpsertCareLineTemplate(\n    $key: String!, $name: String!, $indicator: String!, $declaredCondition: String, $eligibility: JSON!, $practices: JSON!\n  ) {\n    upsertCareLineTemplate(key: $key, name: $name, indicator: $indicator, declaredCondition: $declaredCondition,\n      eligibility: $eligibility, practices: $practices) {\n      ok errors { path message }\n    }\n  }\n": types.UpsertCareLineTemplateDocument,
    "\n  query Cities($status: CityStatus) {\n    cities(status: $status) { slug name uf status schemaVersion schemaBehind createdAt }\n  }\n": types.CitiesDocument,
    "\n  query CityHeader($slug: String!) {\n    city(slug: $slug) {\n      slug name uf status schemaVersion schemaBehind createdAt\n      channel { phoneNumberId wabaId displayPhoneNumber active }\n    }\n  }\n": types.CityHeaderDocument,
    "\n  query CityProfile($slug: String!) { city(slug: $slug) { slug consentTermVersion profile { name uf ibgeCode } } }\n": types.CityProfileDocument,
    "\n  query CityRecipients($slug: String!) {\n    city(slug: $slug) { slug alertRecipients { channel destination escalationOrder } }\n  }\n": types.CityRecipientsDocument,
    "\n  query CityAccounts($slug: String!) { city(slug: $slug) { slug accounts { login roles active mfaEnrolled } } }\n": types.CityAccountsDocument,
    "\n  query CityCounts($slug: String!) {\n    city(slug: $slug) { slug counts { users conversations triages inboundMessages reportSnapshots consents } }\n  }\n": types.CityCountsDocument,
    "\n  query CityOperations($slug: String!) {\n    city(slug: $slug) {\n      slug\n      operations {\n        domainEvents { name occurredAt publishedAt }\n        reportSnapshots { id createdAt expiresAt }\n        dashboardMetrics { dimension period label value computedAt }\n        failedJobs { className failedAt errorClass }\n      }\n    }\n  }\n": types.CityOperationsDocument,
    "\n  query CityFeatures($slug: String!) {\n    city(slug: $slug) {\n      slug\n      recordMode\n      profile { ibgeCode }\n      features { key description enabled usable missing changedAt changedBy }\n    }\n  }\n": types.CityFeaturesDocument,
    "\n  mutation SetCityFeature($citySlug: String!, $key: String!, $enabled: Boolean!) {\n    setCityFeature(citySlug: $citySlug, key: $key, enabled: $enabled) {\n      ok\n      errors { path message }\n      feature { key description enabled usable missing changedAt changedBy }\n    }\n  }\n": types.SetCityFeatureDocument,
    "\n  mutation UpsertLabAnalyteTemplate(\n    $id: ID, $labExamTemplateId: ID!, $key: String!, $name: String!, $loinc: String, $unit: String,\n    $valueType: String!, $choices: [String!], $decimals: Int!, $position: Int!, $referenceRanges: [LabReferenceRangeInput!]!\n  ) {\n    upsertLabAnalyteTemplate(\n      id: $id, labExamTemplateId: $labExamTemplateId, key: $key, name: $name, loinc: $loinc, unit: $unit,\n      valueType: $valueType, choices: $choices, decimals: $decimals, position: $position, referenceRanges: $referenceRanges\n    ) { ok errors { path message } }\n  }\n": types.UpsertLabAnalyteTemplateDocument,
    "\n  query LabExamTemplates {\n    labExamTemplates {\n      id sigtapCode name sector material container suggestedMethod preparation active\n      analytes {\n        id key name loinc unit valueType choices decimals position\n        referenceRanges { sex ageMinDays ageMaxDays low high text }\n      }\n    }\n  }\n": types.LabExamTemplatesDocument,
    "\n  mutation UpsertLabExamTemplate(\n    $id: ID, $sigtapCode: String!, $name: String!, $sector: String!, $material: String!, $container: String!,\n    $suggestedMethod: String, $preparation: String, $active: Boolean!\n  ) {\n    upsertLabExamTemplate(\n      id: $id, sigtapCode: $sigtapCode, name: $name, sector: $sector, material: $material, container: $container,\n      suggestedMethod: $suggestedMethod, preparation: $preparation, active: $active\n    ) { ok errors { path message } }\n  }\n": types.UpsertLabExamTemplateDocument,
    "\n  mutation InviteMaintainer($emailAddress: String!, $code: String!) {\n    inviteMaintainer(emailAddress: $emailAddress, code: $code) { ok errors { path message } }\n  }\n": types.InviteMaintainerDocument,
    "\n  mutation DeactivateMaintainer($id: ID!) { deactivateMaintainer(id: $id) { ok errors { path message } } }\n": types.DeactivateMaintainerDocument,
    "\n  query MedicationCatalog($first: Int!) {\n    medicationCatalog {\n      currentRelease { id importedAt itemsCount hiddenCount }\n      reviewItems(first: $first) { catmatCode sourceDescription parseStatus }\n    }\n  }\n": types.MedicationCatalogDocument,
    "\n  mutation ImportMedicationCatalog {\n    importMedicationCatalog { ok releaseId added changed removed errors { path message } }\n  }\n": types.ImportMedicationCatalogDocument,
    "\n  mutation ImportAnvisaLists {\n    importAnvisaLists { ok antimicrobials controlled errors { path message } }\n  }\n": types.ImportAnvisaListsDocument,
    "\n  query CityPecConfig($slug: String!) {\n    cityPecConfig(citySlug: $slug) { pecOrigin hmacKeyConfigured hmacKeyUpdatedAt }\n  }\n": types.CityPecConfigDocument,
    "\n  mutation SetCityPecOrigin($citySlug: String!, $pecOrigin: String) {\n    setCityPecOrigin(citySlug: $citySlug, pecOrigin: $pecOrigin) { ok errors { path message } }\n  }\n": types.SetCityPecOriginDocument,
    "\n  mutation RotateCityPecHmacKey($citySlug: String!, $key: String!, $code: String!) {\n    rotateCityPecHmacKey(citySlug: $citySlug, key: $key, code: $code) { ok errors { path message } }\n  }\n": types.RotateCityPecHmacKeyDocument,
    "\n  query CityProtocolVersions($slug: String!) {\n    city(slug: $slug) {\n      slug\n      protocolVersions {\n        name version status\n        publicationSignatures publicationMissing\n        activationSignatures activationMissing\n        eligibleReviewers revertible revertTargetVersion\n      }\n    }\n  }\n": types.CityProtocolVersionsDocument,
    "\n  mutation SubmitProtocolForReview($citySlug: String!, $name: String!, $version: Int!) {\n    submitProtocolForReview(citySlug: $citySlug, name: $name, version: $version) { ok errors { path message } }\n  }\n": types.SubmitProtocolForReviewDocument,
    "\n  mutation PublishProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    publishProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n": types.PublishProtocolDocument,
    "\n  mutation ActivateProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    activateProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n": types.ActivateProtocolDocument,
    "\n  mutation RetireProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    retireProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n": types.RetireProtocolDocument,
    "\n  mutation RevertProtocolActivation($citySlug: String!, $name: String!, $reason: String!, $code: String!, $expectedVersion: Int) {\n    revertProtocolActivation(citySlug: $citySlug, name: $name, reason: $reason, code: $code, expectedVersion: $expectedVersion) {\n      ok\n      revertedToVersion\n      errors { path message }\n    }\n  }\n": types.RevertProtocolActivationDocument,
    "\n  query SignaturePlatform {\n    signatureProviders { key configured lastCheckAt lastCheckOk }\n    signerStatus { reachable version crlUpdatedAt }\n  }\n": types.SignaturePlatformDocument,
    "\n  query SncrPlatform {\n    sncrStatus { configured reachable lastCheckAt simulatedAvailable }\n  }\n": types.SncrPlatformDocument,
    "\n  query MaintenanceTokens {\n    maintenanceTokens { id name access citySlugs expiresAt revokedAt lastUsedAt }\n  }\n": types.MaintenanceTokensDocument,
    "\n  query CitiesForTokenScope { cities { slug name } }\n": types.CitiesForTokenScopeDocument,
    "\n  mutation CreateMaintenanceToken($name: String!, $access: String!, $citySlugs: [String!], $expiresAt: ISO8601DateTime!, $code: String!) {\n    createMaintenanceToken(name: $name, access: $access, citySlugs: $citySlugs, expiresAt: $expiresAt, code: $code) {\n      ok secretOnce errors { path message }\n    }\n  }\n": types.CreateMaintenanceTokenDocument,
    "\n  mutation RevokeMaintenanceToken($id: ID!) { revokeMaintenanceToken(id: $id) { ok errors { path message } } }\n": types.RevokeMaintenanceTokenDocument,
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
export function graphql(source: "\n  query CityAnalyticsStatus($slug: String!) {\n    city(slug: $slug) {\n      slug\n      analyticsStatus { lastRunStatus lastSucceededAt lastPublishedAt lastError stale }\n    }\n  }\n"): (typeof documents)["\n  query CityAnalyticsStatus($slug: String!) {\n    city(slug: $slug) {\n      slug\n      analyticsStatus { lastRunStatus lastSucceededAt lastPublishedAt lastError stale }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CityAnalyticsIndicators($slug: String!, $from: ISO8601Date!, $to: ISO8601Date!) {\n    city(slug: $slug) {\n      slug\n      analyticsIndicators(from: $from, to: $to) { weekStart indicator value suppressed }\n    }\n  }\n"): (typeof documents)["\n  query CityAnalyticsIndicators($slug: String!, $from: ISO8601Date!, $to: ISO8601Date!) {\n    city(slug: $slug) {\n      slug\n      analyticsIndicators(from: $from, to: $to) { weekStart indicator value suppressed }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Maintainers { maintainers { id emailAddress active enrolled createdAt } }\n"): (typeof documents)["\n  query Maintainers { maintainers { id emailAddress active enrolled createdAt } }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query AuditEvents($since: ISO8601DateTime, $until: ISO8601DateTime, $maintainerId: ID, $module: String, $outcome: String, $limit: Int) {\n    auditEvents(since: $since, until: $until, maintainerId: $maintainerId, module: $module, outcome: $outcome, limit: $limit) {\n      name module outcome occurredAt maintainerId login correlationId\n    }\n  }\n"): (typeof documents)["\n  query AuditEvents($since: ISO8601DateTime, $until: ISO8601DateTime, $maintainerId: ID, $module: String, $outcome: String, $limit: Int) {\n    auditEvents(since: $since, until: $until, maintainerId: $maintainerId, module: $module, outcome: $outcome, limit: $limit) {\n      name module outcome occurredAt maintainerId login correlationId\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CareLineTemplates {\n    careLineTemplates { key version current name indicator declaredCondition eligibility practices createdAt createdBy }\n  }\n"): (typeof documents)["\n  query CareLineTemplates {\n    careLineTemplates { key version current name indicator declaredCondition eligibility practices createdAt createdBy }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpsertCareLineTemplate(\n    $key: String!, $name: String!, $indicator: String!, $declaredCondition: String, $eligibility: JSON!, $practices: JSON!\n  ) {\n    upsertCareLineTemplate(key: $key, name: $name, indicator: $indicator, declaredCondition: $declaredCondition,\n      eligibility: $eligibility, practices: $practices) {\n      ok errors { path message }\n    }\n  }\n"): (typeof documents)["\n  mutation UpsertCareLineTemplate(\n    $key: String!, $name: String!, $indicator: String!, $declaredCondition: String, $eligibility: JSON!, $practices: JSON!\n  ) {\n    upsertCareLineTemplate(key: $key, name: $name, indicator: $indicator, declaredCondition: $declaredCondition,\n      eligibility: $eligibility, practices: $practices) {\n      ok errors { path message }\n    }\n  }\n"];
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
export function graphql(source: "\n  query CityFeatures($slug: String!) {\n    city(slug: $slug) {\n      slug\n      recordMode\n      profile { ibgeCode }\n      features { key description enabled usable missing changedAt changedBy }\n    }\n  }\n"): (typeof documents)["\n  query CityFeatures($slug: String!) {\n    city(slug: $slug) {\n      slug\n      recordMode\n      profile { ibgeCode }\n      features { key description enabled usable missing changedAt changedBy }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetCityFeature($citySlug: String!, $key: String!, $enabled: Boolean!) {\n    setCityFeature(citySlug: $citySlug, key: $key, enabled: $enabled) {\n      ok\n      errors { path message }\n      feature { key description enabled usable missing changedAt changedBy }\n    }\n  }\n"): (typeof documents)["\n  mutation SetCityFeature($citySlug: String!, $key: String!, $enabled: Boolean!) {\n    setCityFeature(citySlug: $citySlug, key: $key, enabled: $enabled) {\n      ok\n      errors { path message }\n      feature { key description enabled usable missing changedAt changedBy }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpsertLabAnalyteTemplate(\n    $id: ID, $labExamTemplateId: ID!, $key: String!, $name: String!, $loinc: String, $unit: String,\n    $valueType: String!, $choices: [String!], $decimals: Int!, $position: Int!, $referenceRanges: [LabReferenceRangeInput!]!\n  ) {\n    upsertLabAnalyteTemplate(\n      id: $id, labExamTemplateId: $labExamTemplateId, key: $key, name: $name, loinc: $loinc, unit: $unit,\n      valueType: $valueType, choices: $choices, decimals: $decimals, position: $position, referenceRanges: $referenceRanges\n    ) { ok errors { path message } }\n  }\n"): (typeof documents)["\n  mutation UpsertLabAnalyteTemplate(\n    $id: ID, $labExamTemplateId: ID!, $key: String!, $name: String!, $loinc: String, $unit: String,\n    $valueType: String!, $choices: [String!], $decimals: Int!, $position: Int!, $referenceRanges: [LabReferenceRangeInput!]!\n  ) {\n    upsertLabAnalyteTemplate(\n      id: $id, labExamTemplateId: $labExamTemplateId, key: $key, name: $name, loinc: $loinc, unit: $unit,\n      valueType: $valueType, choices: $choices, decimals: $decimals, position: $position, referenceRanges: $referenceRanges\n    ) { ok errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query LabExamTemplates {\n    labExamTemplates {\n      id sigtapCode name sector material container suggestedMethod preparation active\n      analytes {\n        id key name loinc unit valueType choices decimals position\n        referenceRanges { sex ageMinDays ageMaxDays low high text }\n      }\n    }\n  }\n"): (typeof documents)["\n  query LabExamTemplates {\n    labExamTemplates {\n      id sigtapCode name sector material container suggestedMethod preparation active\n      analytes {\n        id key name loinc unit valueType choices decimals position\n        referenceRanges { sex ageMinDays ageMaxDays low high text }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpsertLabExamTemplate(\n    $id: ID, $sigtapCode: String!, $name: String!, $sector: String!, $material: String!, $container: String!,\n    $suggestedMethod: String, $preparation: String, $active: Boolean!\n  ) {\n    upsertLabExamTemplate(\n      id: $id, sigtapCode: $sigtapCode, name: $name, sector: $sector, material: $material, container: $container,\n      suggestedMethod: $suggestedMethod, preparation: $preparation, active: $active\n    ) { ok errors { path message } }\n  }\n"): (typeof documents)["\n  mutation UpsertLabExamTemplate(\n    $id: ID, $sigtapCode: String!, $name: String!, $sector: String!, $material: String!, $container: String!,\n    $suggestedMethod: String, $preparation: String, $active: Boolean!\n  ) {\n    upsertLabExamTemplate(\n      id: $id, sigtapCode: $sigtapCode, name: $name, sector: $sector, material: $material, container: $container,\n      suggestedMethod: $suggestedMethod, preparation: $preparation, active: $active\n    ) { ok errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InviteMaintainer($emailAddress: String!, $code: String!) {\n    inviteMaintainer(emailAddress: $emailAddress, code: $code) { ok errors { path message } }\n  }\n"): (typeof documents)["\n  mutation InviteMaintainer($emailAddress: String!, $code: String!) {\n    inviteMaintainer(emailAddress: $emailAddress, code: $code) { ok errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeactivateMaintainer($id: ID!) { deactivateMaintainer(id: $id) { ok errors { path message } } }\n"): (typeof documents)["\n  mutation DeactivateMaintainer($id: ID!) { deactivateMaintainer(id: $id) { ok errors { path message } } }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MedicationCatalog($first: Int!) {\n    medicationCatalog {\n      currentRelease { id importedAt itemsCount hiddenCount }\n      reviewItems(first: $first) { catmatCode sourceDescription parseStatus }\n    }\n  }\n"): (typeof documents)["\n  query MedicationCatalog($first: Int!) {\n    medicationCatalog {\n      currentRelease { id importedAt itemsCount hiddenCount }\n      reviewItems(first: $first) { catmatCode sourceDescription parseStatus }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ImportMedicationCatalog {\n    importMedicationCatalog { ok releaseId added changed removed errors { path message } }\n  }\n"): (typeof documents)["\n  mutation ImportMedicationCatalog {\n    importMedicationCatalog { ok releaseId added changed removed errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ImportAnvisaLists {\n    importAnvisaLists { ok antimicrobials controlled errors { path message } }\n  }\n"): (typeof documents)["\n  mutation ImportAnvisaLists {\n    importAnvisaLists { ok antimicrobials controlled errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CityPecConfig($slug: String!) {\n    cityPecConfig(citySlug: $slug) { pecOrigin hmacKeyConfigured hmacKeyUpdatedAt }\n  }\n"): (typeof documents)["\n  query CityPecConfig($slug: String!) {\n    cityPecConfig(citySlug: $slug) { pecOrigin hmacKeyConfigured hmacKeyUpdatedAt }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SetCityPecOrigin($citySlug: String!, $pecOrigin: String) {\n    setCityPecOrigin(citySlug: $citySlug, pecOrigin: $pecOrigin) { ok errors { path message } }\n  }\n"): (typeof documents)["\n  mutation SetCityPecOrigin($citySlug: String!, $pecOrigin: String) {\n    setCityPecOrigin(citySlug: $citySlug, pecOrigin: $pecOrigin) { ok errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RotateCityPecHmacKey($citySlug: String!, $key: String!, $code: String!) {\n    rotateCityPecHmacKey(citySlug: $citySlug, key: $key, code: $code) { ok errors { path message } }\n  }\n"): (typeof documents)["\n  mutation RotateCityPecHmacKey($citySlug: String!, $key: String!, $code: String!) {\n    rotateCityPecHmacKey(citySlug: $citySlug, key: $key, code: $code) { ok errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CityProtocolVersions($slug: String!) {\n    city(slug: $slug) {\n      slug\n      protocolVersions {\n        name version status\n        publicationSignatures publicationMissing\n        activationSignatures activationMissing\n        eligibleReviewers revertible revertTargetVersion\n      }\n    }\n  }\n"): (typeof documents)["\n  query CityProtocolVersions($slug: String!) {\n    city(slug: $slug) {\n      slug\n      protocolVersions {\n        name version status\n        publicationSignatures publicationMissing\n        activationSignatures activationMissing\n        eligibleReviewers revertible revertTargetVersion\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SubmitProtocolForReview($citySlug: String!, $name: String!, $version: Int!) {\n    submitProtocolForReview(citySlug: $citySlug, name: $name, version: $version) { ok errors { path message } }\n  }\n"): (typeof documents)["\n  mutation SubmitProtocolForReview($citySlug: String!, $name: String!, $version: Int!) {\n    submitProtocolForReview(citySlug: $citySlug, name: $name, version: $version) { ok errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation PublishProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    publishProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n"): (typeof documents)["\n  mutation PublishProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    publishProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation ActivateProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    activateProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n"): (typeof documents)["\n  mutation ActivateProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    activateProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RetireProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    retireProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n"): (typeof documents)["\n  mutation RetireProtocol($citySlug: String!, $name: String!, $version: Int!, $code: String!) {\n    retireProtocol(citySlug: $citySlug, name: $name, version: $version, code: $code) { ok errors { path message } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RevertProtocolActivation($citySlug: String!, $name: String!, $reason: String!, $code: String!, $expectedVersion: Int) {\n    revertProtocolActivation(citySlug: $citySlug, name: $name, reason: $reason, code: $code, expectedVersion: $expectedVersion) {\n      ok\n      revertedToVersion\n      errors { path message }\n    }\n  }\n"): (typeof documents)["\n  mutation RevertProtocolActivation($citySlug: String!, $name: String!, $reason: String!, $code: String!, $expectedVersion: Int) {\n    revertProtocolActivation(citySlug: $citySlug, name: $name, reason: $reason, code: $code, expectedVersion: $expectedVersion) {\n      ok\n      revertedToVersion\n      errors { path message }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SignaturePlatform {\n    signatureProviders { key configured lastCheckAt lastCheckOk }\n    signerStatus { reachable version crlUpdatedAt }\n  }\n"): (typeof documents)["\n  query SignaturePlatform {\n    signatureProviders { key configured lastCheckAt lastCheckOk }\n    signerStatus { reachable version crlUpdatedAt }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SncrPlatform {\n    sncrStatus { configured reachable lastCheckAt simulatedAvailable }\n  }\n"): (typeof documents)["\n  query SncrPlatform {\n    sncrStatus { configured reachable lastCheckAt simulatedAvailable }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query MaintenanceTokens {\n    maintenanceTokens { id name access citySlugs expiresAt revokedAt lastUsedAt }\n  }\n"): (typeof documents)["\n  query MaintenanceTokens {\n    maintenanceTokens { id name access citySlugs expiresAt revokedAt lastUsedAt }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query CitiesForTokenScope { cities { slug name } }\n"): (typeof documents)["\n  query CitiesForTokenScope { cities { slug name } }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateMaintenanceToken($name: String!, $access: String!, $citySlugs: [String!], $expiresAt: ISO8601DateTime!, $code: String!) {\n    createMaintenanceToken(name: $name, access: $access, citySlugs: $citySlugs, expiresAt: $expiresAt, code: $code) {\n      ok secretOnce errors { path message }\n    }\n  }\n"): (typeof documents)["\n  mutation CreateMaintenanceToken($name: String!, $access: String!, $citySlugs: [String!], $expiresAt: ISO8601DateTime!, $code: String!) {\n    createMaintenanceToken(name: $name, access: $access, citySlugs: $citySlugs, expiresAt: $expiresAt, code: $code) {\n      ok secretOnce errors { path message }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation RevokeMaintenanceToken($id: ID!) { revokeMaintenanceToken(id: $id) { ok errors { path message } } }\n"): (typeof documents)["\n  mutation RevokeMaintenanceToken($id: ID!) { revokeMaintenanceToken(id: $id) { ok errors { path message } } }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;