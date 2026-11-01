package com.nightcrawlers.common.audit;

public enum AuditEvent {
    REGISTER,
    LOGIN_SUCCESS,
    LOGIN_FAILURE,
    LOGOUT,
    LOGOUT_ALL,
    REFRESH_REUSE,
    REFRESH_GRACE,
    PASSWORD_RESET,
    ACCOUNT_DELETED,
    RIPPERDOC_PURCHASE,
    RUN_FLAGGED,
    ACCOUNT_LOCKED
}
