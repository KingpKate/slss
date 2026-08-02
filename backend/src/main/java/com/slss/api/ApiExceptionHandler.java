package com.slss.api;
import jakarta.servlet.http.HttpServletRequest; import org.springframework.http.*; import org.springframework.web.bind.annotation.*; import org.springframework.web.server.ResponseStatusException; import org.springframework.security.access.AccessDeniedException;
@RestControllerAdvice public class ApiExceptionHandler {
 @ExceptionHandler(ResponseStatusException.class) ResponseEntity<ApiError> status(ResponseStatusException e,HttpServletRequest r){return ResponseEntity.status(e.getStatusCode()).body(ApiError.of("BUSINESS_ERROR",e.getReason(),r.getRequestURI()));}
 @ExceptionHandler(AccessDeniedException.class) ResponseEntity<ApiError> denied(AccessDeniedException e,HttpServletRequest r){return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiError.of("ACCESS_DENIED","无权执行该操作",r.getRequestURI()));}
 @ExceptionHandler(IllegalStateException.class) ResponseEntity<ApiError> conflict(IllegalStateException e,HttpServletRequest r){return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of("INVALID_STATE",e.getMessage(),r.getRequestURI()));}
 @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class) ResponseEntity<ApiError> optimistic(Exception e,HttpServletRequest r){return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of("VERSION_CONFLICT","数据已被其他用户修改，请刷新后重试",r.getRequestURI()));}
 @ExceptionHandler(Exception.class) ResponseEntity<ApiError> generic(Exception e,HttpServletRequest r){return ResponseEntity.status(500).body(ApiError.of("INTERNAL_ERROR","服务器内部错误",r.getRequestURI()));}
}
