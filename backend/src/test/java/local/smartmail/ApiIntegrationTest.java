package local.smartmail;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import tools.jackson.databind.json.JsonMapper;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties={"assistant.mode=demo","assistant.gemini.api-key=","spring.config.import="})
class ApiIntegrationTest {
    @LocalServerPort int port;
    final HttpClient http=HttpClient.newHttpClient();
    HttpResponse<String> post(String body) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/email/generate"))
                .header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
    }
    @Test void demoEndpointReturnsEditableTemplateAndTruthfulMode() throws Exception {
        var result=post("{\"emailContent\":\"Can we schedule a meeting?\",\"tone\":\"friendly\",\"senderName\":\"Aditya\"}");
        assertEquals(200,result.statusCode());assertTrue(result.body().contains("demo"));assertTrue(result.body().contains("Aditya"));
        assertTrue(result.body().contains("[add your available dates and times]"));
    }
    @Test void blankInputIsRejected() throws Exception {assertEquals(400,post("{\"emailContent\":\"  \"}").statusCode());}
    @Test void invalidToneIsRejected() throws Exception {assertEquals(400,post("{\"emailContent\":\"Hello\",\"tone\":\"anything\"}").statusCode());}
    @Test void oversizedEmailIsRejected() throws Exception {
        String body=JsonMapper.builder().build().writeValueAsString(Map.of("emailContent","x".repeat(20001)));
        assertEquals(400,post(body).statusCode());
    }
    @Test void invalidJsonIsRejected() throws Exception {assertEquals(400,post("not-json").statusCode());}
    @Test void statusDoesNotExposeSecrets() throws Exception {
        var result=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/status")).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,result.statusCode());assertTrue(result.body().contains("configured"));assertFalse(result.body().contains("api-key"));
    }
    @Test void unrelatedWebsiteCannotCallApiThroughCors() throws Exception {
        var result=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/email/generate"))
                .header("Origin","https://unrelated.example").header("Access-Control-Request-Method","POST").method("OPTIONS",HttpRequest.BodyPublishers.noBody()).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(403,result.statusCode());
    }
    @Test void extensionOriginCanCallApi() throws Exception {
        var result=http.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/email/generate"))
                .header("Origin","chrome-extension://abcdefghijklmnop").header("Access-Control-Request-Method","POST").method("OPTIONS",HttpRequest.BodyPublishers.noBody()).build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(200,result.statusCode());
    }
    @Test void missingGeminiKeyDoesNotFallBackToFakeAi() {
        EmailService service=new EmailService("gemini","","test");
        assertEquals(503,assertThrows(ApiException.class,()->service.generate(new EmailRequest("Hello",null,null,null))).status);
    }
}
