package com.slss.api;

import java.time.OffsetDateTime;

public record ApiError(String code, String message, String path, OffsetDateTime timestamp) {
  public static ApiError of(String code, String message, String path) { return new ApiError(code, message, path, OffsetDateTime.now()); }
}
