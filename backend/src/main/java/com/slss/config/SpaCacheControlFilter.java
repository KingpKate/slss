package com.slss.config;
import jakarta.servlet.*; import jakarta.servlet.http.*; import org.springframework.stereotype.Component; import org.springframework.web.filter.OncePerRequestFilter; import java.io.IOException;
@Component public class SpaCacheControlFilter extends OncePerRequestFilter {
 @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
  String uri=request.getRequestURI();if(uri.endsWith("/")||uri.endsWith("/index.html"))response.setHeader("Cache-Control","no-store, no-cache, must-revalidate");chain.doFilter(request,response);
 }
}
