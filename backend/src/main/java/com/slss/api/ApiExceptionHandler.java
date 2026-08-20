package com.slss.api;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.access.AccessDeniedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Stable problem payload consumed by the admin console and support tooling. */
@RestControllerAdvice public class ApiExceptionHandler {
 private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
 record ApiError(String code, String message, String path, String traceId, Instant timestamp) {
   static ApiError of(String code, String message, HttpServletRequest request) {
     return new ApiError(code, message == null ? "请求失败" : message, request.getRequestURI(), requestTraceId(request), Instant.now());
   }
 }
 private static String requestTraceId(HttpServletRequest request) {
   var existing = request.getHeader("X-Request-Id");
   return existing == null || existing.isBlank() ? UUID.randomUUID().toString() : existing;
 }
 private static <T> ResponseEntity<T> response(HttpStatusCode status, T body, String traceId) {
   return ResponseEntity.status(status).header("X-Request-Id", traceId).body(body);
 }
 @ExceptionHandler(ResponseStatusException.class) ResponseEntity<ApiError> status(ResponseStatusException e,HttpServletRequest r){var b=ApiError.of("BUSINESS_ERROR",e.getReason(),r);return response(e.getStatusCode(),b,b.traceId());}
 @ExceptionHandler(AccessDeniedException.class) ResponseEntity<ApiError> denied(AccessDeniedException e,HttpServletRequest r){var b=ApiError.of("ACCESS_DENIED","无权执行该操作",r);return response(HttpStatus.FORBIDDEN,b,b.traceId());}
 @ExceptionHandler(IllegalStateException.class) ResponseEntity<ApiError> conflict(IllegalStateException e,HttpServletRequest r){var b=ApiError.of("INVALID_STATE",e.getMessage(),r);return response(HttpStatus.CONFLICT,b,b.traceId());}
 @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class) ResponseEntity<ApiError> optimistic(Exception e,HttpServletRequest r){var b=ApiError.of("VERSION_CONFLICT","数据已被其他用户修改，请刷新后重试",r);return response(HttpStatus.CONFLICT,b,b.traceId());}
 @ExceptionHandler(Exception.class) ResponseEntity<ApiError> generic(Exception e,HttpServletRequest r){var b=ApiError.of("INTERNAL_ERROR","服务器内部错误",r);log.error("Unhandled API error traceId={} method={} path={}",b.traceId(),r.getMethod(),r.getRequestURI(),e);return response(HttpStatus.INTERNAL_SERVER_ERROR,b,b.traceId());}
}
