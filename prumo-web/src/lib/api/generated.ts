export interface paths {
    "/api/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Verifica o processo da API */
        get: operations["HealthController_getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/email-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["IdentityController_emailStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/email-verification": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_requestEmailVerification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/email-verification/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_confirmEmailVerification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/email-changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_requestEmailChange"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/email-changes/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_confirmEmailChange"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/email-changes/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_cancelEmailChange"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sign-in": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_signIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["IdentityController_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sign-out": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_signOut"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/sign-out-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_signOutAll"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/change-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_changePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/recovery-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_issueRecoveryCodes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/recover-with-code": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IdentityController_recoverWithCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HouseholdController_list"];
        put?: never;
        post: operations["HouseholdController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HouseholdController_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["HouseholdController_rename"];
        trace?: never;
    };
    "/api/households/{id}/memberships": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HouseholdController_listMemberships"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{id}/memberships/{userId}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["HouseholdController_revokeMembership"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{id}/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["HouseholdInvitationController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{id}/invitations/{requestId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["HouseholdInvitationController_cancel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AuthInvitationController_inbox"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/invitations/{invitationId}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AuthInvitationController_accept"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/transactions/unclassified-outflows": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OutflowController_list"];
        put?: never;
        post: operations["OutflowController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/transactions/unclassified-outflows/{eventId}/arrival-links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["OutflowController_link"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/transactions/unclassified-outflows/{eventId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OutflowController_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AccountController_list"];
        put?: never;
        post: operations["AccountController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/accounts/{accountId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AccountController_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/transactions/income": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["IncomeController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/transactions/{eventId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["IncomeController_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/accounts/{accountId}/balance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["IncomeController_balance"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/accounts/{accountId}/movements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["IncomeController_movements"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/expense-categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ExpenseController_listCategories"];
        put?: never;
        post: operations["ExpenseController_createCategory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/transactions/expenses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ExpenseController_createExpense"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/transactions/transfers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["TransferController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/transactions/transfers/{eventId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["TransferController_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/transfers/in-transit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["TransferController_inTransit"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/households/{householdId}/accounts/{accountId}/opening-balance-revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["OpeningBalanceRevisionController_list"];
        put?: never;
        post: operations["OpeningBalanceRevisionController_revise"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        HealthResponseDto: {
            /** @enum {string} */
            status: "ok";
        };
        EmailPendingChangeResponse: {
            newEmail: string;
            /** Format: date-time */
            expiresAt: string;
            requiresOldCode: boolean;
        };
        EmailStatusResponse: {
            email: string;
            verified: boolean;
            pendingChange: components["schemas"]["EmailPendingChangeResponse"] | null;
        };
        EmailCodeBody: {
            code: string;
        };
        EmailChangeBody: {
            /** @example new@example.com */
            newEmail: string;
            /** Format: password */
            currentPassword: string;
        };
        ConfirmEmailChangeBody: {
            newCode: string;
            oldCode?: string;
        };
        SignInBody: {
            /** @example person@example.com */
            email: string;
            /** Format: password */
            password: string;
        };
        CurrentUserResponse: {
            id: string;
            email: string;
        };
        ChangePasswordBody: {
            /** Format: password */
            currentPassword: string;
            /** Format: password */
            newPassword: string;
        };
        IssueRecoveryCodesBody: {
            /** Format: password */
            currentPassword: string;
        };
        RecoveryCodesResponse: {
            codes: string[];
        };
        RecoverWithCodeBody: {
            /** @example person@example.com */
            email: string;
            code: string;
            /** Format: password */
            newPassword: string;
        };
        HouseholdNameBody: {
            name: string;
        };
        HouseholdResponse: {
            /** Format: uuid */
            id: string;
            name: string;
            /** @enum {string} */
            role: "OWNER" | "MEMBER" | "VIEWER";
        };
        MembershipResponse: {
            /** Format: uuid */
            userId: string;
            /** @enum {string} */
            role: "OWNER" | "MEMBER" | "VIEWER";
        };
        InvitationBody: {
            /** Format: uuid */
            inviteeUserId: string;
        };
        InvitationRequestResponse: {
            /**
             * Format: uuid
             * @description Opaque request identifier; delivery is not confirmed.
             */
            requestId: string;
        };
        InvitationResponse: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            householdId: string;
            householdName: string;
            /** @enum {string} */
            role: "VIEWER";
            /** Format: date-time */
            expiresAt: string;
        };
        OutflowBody: {
            /** Format: uuid */
            sourceAccountId: string;
            /** @description Positive BRL cents, at most 9007199254740991. */
            amountCents: string;
            /** @enum {string} */
            currency: "BRL";
            /** Format: date */
            sourceEffectiveDate: string;
            description: string;
        };
        ResolutionResponse: {
            /** Format: uuid */
            actorUserId: string;
            reason: string;
            /** Format: date-time */
            recordedAt: string;
            /** @enum {number} */
            previousVersion: 1;
        };
        OutflowResponse: {
            /** Format: uuid */
            sourceAccountId: string;
            /** @description Positive BRL cents, at most 9007199254740991. */
            amountCents: string;
            /** @enum {string} */
            currency: "BRL";
            /** Format: date */
            sourceEffectiveDate: string;
            description: string;
            /** Format: uuid */
            eventId: string;
            /** @enum {number} */
            version: 1 | 2;
            /** @enum {string} */
            type: "UNCLASSIFIED_OUTFLOW" | "INTERNAL_TRANSFER";
            /** Format: uuid */
            sourceMovementId: string;
            sourceMovementAmountCents: string;
            /** @enum {string} */
            sourceState: "APPLIED" | "PENDING_PRE_OPENING";
            /** @enum {string} */
            sourceDateProvenance: "MANUAL_USER";
            /** Format: date-time */
            recordedAt: string;
            /** Format: uuid */
            recordedByUserId: string;
            /** Format: uuid */
            destinationAccountId: string | null;
            /** Format: uuid */
            destinationMovementId: string | null;
            /** Format: date */
            destinationEffectiveDate: string | null;
            /** @enum {string|null} */
            destinationState: "APPLIED" | "PENDING_PRE_OPENING" | null;
            destinationMovementAmountCents: string | null;
            resolution: components["schemas"]["ResolutionResponse"] | null;
        };
        ArrivalBody: {
            /** @enum {number} */
            expectedVersion: 1;
            /** Format: uuid */
            destinationAccountId: string;
            /** Format: date */
            destinationEffectiveDate: string;
            reason: string;
        };
        OutflowPage: {
            /** Format: date */
            date: string;
            /** @enum {string} */
            currency: "BRL";
            /** @description Exact aggregate of economically unclassified debits, separate from confirmed transit. */
            reviewOutflowCents: string;
            hasUnclassifiedOutflow: boolean;
            items: components["schemas"]["OutflowResponse"][];
            nextCursor: string | null;
        };
        AccountBody: {
            name: string;
            /** @enum {string} */
            currency: "BRL";
            /**
             * Format: date
             * @example 2026-11-03
             */
            openingDate: string;
            /**
             * @description Signed integer cents as a decimal string.
             * @example -12345
             */
            openingBalanceCents: string;
        };
        AccountResponse: {
            name: string;
            /** @enum {string} */
            currency: "BRL";
            /**
             * Format: date
             * @example 2026-11-03
             */
            openingDate: string;
            /**
             * @description Signed integer cents as a decimal string.
             * @example -12345
             */
            openingBalanceCents: string;
            /** Format: uuid */
            id: string;
            /** @example 1 */
            openingVersion: number;
        };
        IncomeBody: {
            /** Format: uuid */
            accountId: string;
            /**
             * @description Positive integer cents, at most 9007199254740991.
             * @example 20000
             */
            amountCents: string;
            /** @enum {string} */
            currency: "BRL";
            /** Format: date */
            effectiveDate: string;
            description: string;
        };
        IncomeResponse: {
            /** Format: uuid */
            accountId: string;
            /**
             * @description Positive integer cents, at most 9007199254740991.
             * @example 20000
             */
            amountCents: string;
            /** @enum {string} */
            currency: "BRL";
            /** Format: date */
            effectiveDate: string;
            description: string;
            /** Format: uuid */
            eventId: string;
            /** Format: uuid */
            movementId: string;
            /** @enum {number} */
            version: 1 | 2;
            /** @enum {string} */
            type: "RECEIVED_INCOME" | "DIRECT_EXPENSE" | "INTERNAL_TRANSFER" | "UNCLASSIFIED_OUTFLOW";
            /** Format: uuid */
            categoryId: string | null;
            /** @description Signed account movement in cents. */
            movementAmountCents: string;
            /** @enum {string} */
            state: "APPLIED" | "PENDING_PRE_OPENING";
            /** @enum {string|null} */
            pendingReason: "PRE_OPENING" | null;
            /** @enum {string} */
            dateProvenance: "MANUAL_USER";
            /** Format: date-time */
            recordedAt: string;
            /** @description Persistent registration order, not real-world chronology. */
            sequence: string;
        };
        BalanceResponse: {
            /** @enum {string} */
            currency: "BRL";
            /** Format: date */
            date: string;
            /** Format: date */
            openingDate: string;
            openingBalanceCents: string;
            calculable: boolean;
            /** @description Exact signed integer cents. Aggregate has no individual-entry limit. */
            balanceCents: string | null;
            /** @description True when the calculated balance is negative on the requested date; null before the opening date. It is an alert for review, not available bank credit. */
            negativeBalance: boolean | null;
        };
        MovementPageResponse: {
            items: components["schemas"]["IncomeResponse"][];
            /** @description Cursor by effective day and registration sequence. Restart pagination after retroactive insertions for a complete view. */
            nextCursor: string | null;
        };
        CategoryBody: {
            name: string;
        };
        CategoryResponse: {
            name: string;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            householdId: string;
            /** Format: uuid */
            createdByUserId: string;
            /** Format: date-time */
            createdAt: string;
        };
        ExpenseBody: {
            /** Format: uuid */
            accountId: string;
            /** Format: uuid */
            categoryId: string;
            /**
             * @description Positive integer cents, at most 9007199254740991.
             * @example 13000
             */
            amountCents: string;
            /** @enum {string} */
            currency: "BRL";
            /** Format: date */
            effectiveDate: string;
            description: string;
        };
        ExpenseResponse: {
            /** Format: uuid */
            accountId: string;
            /** Format: uuid */
            categoryId: string;
            /**
             * @description Positive integer cents, at most 9007199254740991.
             * @example 13000
             */
            amountCents: string;
            /** @enum {string} */
            currency: "BRL";
            /** Format: date */
            effectiveDate: string;
            description: string;
            /** Format: uuid */
            eventId: string;
            /** Format: uuid */
            movementId: string;
            /** @enum {number} */
            version: 1;
            /** @enum {string} */
            type: "DIRECT_EXPENSE";
            /** @description Negative account movement in cents. */
            movementAmountCents: string;
            /** @enum {string} */
            state: "APPLIED" | "PENDING_PRE_OPENING";
            /** @enum {string|null} */
            pendingReason: "PRE_OPENING" | null;
            /** @enum {string} */
            dateProvenance: "MANUAL_USER";
            /** Format: date-time */
            recordedAt: string;
            /** @description Persistent registration order, not real-world chronology. */
            sequence: string;
        };
        TransferBody: {
            /** Format: uuid */
            sourceAccountId: string;
            /** Format: uuid */
            destinationAccountId: string;
            /** @description Positive integer cents, at most 9007199254740991. */
            amountCents: string;
            /** @enum {string} */
            currency: "BRL";
            /** Format: date */
            sourceEffectiveDate: string;
            /** Format: date */
            destinationEffectiveDate: string;
            description: string;
        };
        TransferResponse: {
            /** Format: uuid */
            sourceAccountId: string;
            /** Format: uuid */
            destinationAccountId: string;
            /** @description Positive integer cents, at most 9007199254740991. */
            amountCents: string;
            /** @enum {string} */
            currency: "BRL";
            /** Format: date */
            sourceEffectiveDate: string;
            /** Format: date */
            destinationEffectiveDate: string;
            description: string;
            /** Format: uuid */
            eventId: string;
            /** @enum {number} */
            version: 1 | 2;
            /** @enum {string} */
            type: "INTERNAL_TRANSFER";
            /** Format: uuid */
            sourceMovementId: string;
            /** Format: uuid */
            destinationMovementId: string;
            /** @description Signed negative integer cents. */
            sourceMovementAmountCents: string;
            /** @description Signed positive integer cents. */
            destinationMovementAmountCents: string;
            /** @enum {string} */
            sourceDateProvenance: "MANUAL_USER";
            /** @enum {string} */
            destinationDateProvenance: "MANUAL_USER";
            /** Format: date-time */
            recordedAt: string;
            /**
             * @description Current inclusion of the source movement; old creation replays may omit it.
             * @enum {string}
             */
            sourceState?: "APPLIED" | "PENDING_PRE_OPENING";
            /** @enum {string} */
            destinationState?: "APPLIED" | "PENDING_PRE_OPENING";
            /** Format: date */
            sourceOpeningDate?: string;
            /** Format: date */
            destinationOpeningDate?: string;
        };
        InTransitItem: {
            /** Format: uuid */
            eventId: string;
            /** @description Positive integer cents. */
            amountCents: string;
        };
        InTransitResponse: {
            /** Format: date */
            date: string;
            /** @enum {string} */
            currency: "BRL";
            /** @description Exact aggregate integer cents. */
            totalCents: string;
            /** @description True if any confirmed transfer with source day at or before this day has a pending side. The factual transit total alone must not be used as a consolidated balance. */
            hasPendingTransferSide: boolean;
            items: components["schemas"]["InTransitItem"][];
            /** @description Cursor by source day and event ID. */
            nextCursor: string | null;
        };
        RevisionBody: {
            /** @example 1 */
            expectedVersion: number;
            /**
             * @description Signed integer cents as a decimal string.
             * @example 499000
             */
            openingBalanceCents: string;
            /**
             * Format: date
             * @description Opening day at its start; omitted means the current opening day.
             */
            openingDate?: string;
            reason: string;
        };
        RevisionResponse: {
            /** Format: uuid */
            revisionId: Record<string, never> | null;
            /** Format: uuid */
            accountId: string;
            /** @example 2 */
            version: number;
            /** Format: date */
            openingDate: string;
            /**
             * Format: date
             * @description Previous opening day. Historical replays created before this contract omit it.
             */
            previousOpeningDate?: string | null;
            previousBalanceCents: Record<string, never> | null;
            openingBalanceCents: string;
            reason: Record<string, never> | null;
            /** Format: uuid */
            actorUserId: string;
            /** Format: date-time */
            revisedAt: string;
        };
        RevisionPageResponse: {
            items: components["schemas"]["RevisionResponse"][];
            nextCursor: number | null;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    HealthController_getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponseDto"];
                };
            };
        };
    };
    IdentityController_emailStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailStatusResponse"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_requestEmailVerification: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_confirmEmailVerification: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailCodeBody"];
            };
        };
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_requestEmailChange: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EmailChangeBody"];
            };
        };
        responses: {
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_confirmEmailChange: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConfirmEmailChangeBody"];
            };
        };
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_cancelEmailChange: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_signIn: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SignInBody"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CurrentUserResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Tentativas excessivas; consulte Retry-After. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CurrentUserResponse"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_signOut: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_signOutAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_changePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangePasswordBody"];
            };
        };
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_issueRecoveryCodes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IssueRecoveryCodesBody"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecoveryCodesResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IdentityController_recoverWithCode: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RecoverWithCodeBody"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RecoveryCodesResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HouseholdController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HouseholdResponse"][];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HouseholdController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HouseholdNameBody"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HouseholdResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HouseholdController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HouseholdResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HouseholdController_rename: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HouseholdNameBody"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HouseholdResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HouseholdController_listMemberships: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MembershipResponse"][];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HouseholdController_revokeMembership: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Revoked or already inactive. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Owner membership cannot be revoked. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HouseholdInvitationController_create: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InvitationBody"];
            };
        };
        responses: {
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationRequestResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HouseholdInvitationController_cancel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                requestId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AuthInvitationController_inbox: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitationResponse"][];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AuthInvitationController_accept: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                invitationId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OutflowController_list: {
        parameters: {
            query: {
                date: string;
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path: {
                householdId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OutflowPage"];
                };
            };
        };
    };
    OutflowController_create: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
                "Idempotency-Key": string;
            };
            path: {
                householdId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OutflowBody"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OutflowResponse"];
                };
            };
        };
    };
    OutflowController_link: {
        parameters: {
            query?: never;
            header: {
                "idempotency-key": string;
                "Idempotency-Key": string;
            };
            path: {
                householdId: string;
                eventId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ArrivalBody"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OutflowResponse"];
                };
            };
        };
    };
    OutflowController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                householdId: string;
                eventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OutflowResponse"];
                };
            };
        };
    };
    AccountController_list: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                householdId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountResponse"][];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AccountController_create: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID identifying this creation request. */
                "Idempotency-Key": string;
            };
            path: {
                householdId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountBody"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    AccountController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                householdId: string;
                accountId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IncomeController_create: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID identifying the income creation request. */
                "Idempotency-Key": string;
            };
            path: {
                householdId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IncomeBody"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncomeResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IncomeController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                householdId: string;
                eventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncomeResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IncomeController_balance: {
        parameters: {
            query: {
                date: string;
            };
            header?: never;
            path: {
                householdId: string;
                accountId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BalanceResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    IncomeController_movements: {
        parameters: {
            query?: {
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path: {
                householdId: string;
                accountId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MovementPageResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExpenseController_listCategories: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                householdId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryResponse"][];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExpenseController_createCategory: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID identifying the category creation request. */
                "Idempotency-Key": string;
            };
            path: {
                householdId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CategoryBody"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ExpenseController_createExpense: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID identifying the expense creation request. */
                "Idempotency-Key": string;
            };
            path: {
                householdId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ExpenseBody"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ExpenseResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    TransferController_create: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID identifying the transfer creation request. */
                "Idempotency-Key": string;
            };
            path: {
                householdId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TransferBody"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TransferResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    TransferController_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                householdId: string;
                eventId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TransferResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    TransferController_inTransit: {
        parameters: {
            query: {
                date: string;
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path: {
                householdId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InTransitResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OpeningBalanceRevisionController_list: {
        parameters: {
            query?: {
                afterVersion?: number;
                limit?: number;
            };
            header?: never;
            path: {
                householdId: string;
                accountId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RevisionPageResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    OpeningBalanceRevisionController_revise: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID identifying this revision request. */
                "Idempotency-Key": string;
            };
            path: {
                householdId: string;
                accountId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RevisionBody"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RevisionResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
