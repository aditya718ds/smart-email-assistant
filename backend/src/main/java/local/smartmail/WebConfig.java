package local.smartmail;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("chrome-extension://*", "http://127.0.0.1:5173", "http://localhost:5173")
                .allowedMethods("GET", "POST", "OPTIONS").allowedHeaders("Content-Type").maxAge(600);
    }
}
