package local.smartmail;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class GeminiClientTest {
    final GeminiClient parser = new GeminiClient();
    @Test void combinesTextAndExcludesThoughts() {
        assertEquals("Hello\nBest regards", parser.extractReply("""
          {"candidates":[{"finishReason":"STOP","content":{"parts":[
          {"thought":true,"text":"private reasoning"},{"text":"Hello"},{"text":"Best regards"}]}}]}
          """));
    }
    @Test void blockedResponseIsAnActionableError() {
        assertThrows(ApiException.class, () -> parser.extractReply("{\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}"));
    }
    @Test void truncatedResponseIsNotUsedAsACompleteDraft() {
        assertThrows(ApiException.class, () -> parser.extractReply("{\"candidates\":[{\"finishReason\":\"MAX_TOKENS\",\"content\":{\"parts\":[{\"text\":\"half a reply\"}]}}]}"));
    }
    @Test void malformedResponseHasNoInternalDetails() {
        assertTrue(assertThrows(ApiException.class, () -> parser.extractReply("not json")).getMessage().contains("unreadable"));
    }
    @Test void emptyTextIsAnError() {
        assertThrows(ApiException.class, () -> parser.extractReply("{\"candidates\":[{\"finishReason\":\"STOP\",\"content\":{\"parts\":[]}}]}"));
    }
    @Test void sendsKeyInHeaderAndStructuredContentToProvider() throws Exception {
        AtomicReference<String> content=new AtomicReference<>(), key=new AtomicReference<>(), path=new AtomicReference<>();
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/", exchange -> {
            content.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
            key.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
            path.set(exchange.getRequestURI().toString());
            byte[] response="{\"candidates\":[{\"finishReason\":\"STOP\",\"content\":{\"parts\":[{\"text\":\"Reply from provider\"}]}}]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200,response.length);exchange.getResponseBody().write(response);exchange.close();
        });server.start();
        try {
            GeminiClient client=new GeminiClient(HttpClient.newHttpClient(),"http://127.0.0.1:"+server.getAddress().getPort()+"/");
            assertEquals("Reply from provider",client.generate("test-only-key","test-model",new EmailRequest("Hello \"team\"\nNext line","friendly","Ask for agenda","Aditya")));
            assertEquals("test-only-key",key.get());assertEquals("/test-model:generateContent",path.get());
            assertTrue(content.get().contains("systemInstruction"));assertTrue(content.get().contains("Ask for agenda"));
            assertFalse(path.get().contains("test-only-key"));
        } finally {server.stop(0);}
    }
    @Test void quotaErrorsNeverLeakProviderResponseOrKey() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/",e->{byte[] b="sensitive provider error test-key".getBytes();e.sendResponseHeaders(429,b.length);e.getResponseBody().write(b);e.close();});server.start();
        try {
            GeminiClient client=new GeminiClient(HttpClient.newHttpClient(),"http://127.0.0.1:"+server.getAddress().getPort()+"/");
            ApiException e=assertThrows(ApiException.class,()->client.generate("test-key","test",new EmailRequest("Hi",null,null,null)));
            assertEquals(429,e.status);assertFalse(e.getMessage().contains("test-key"));
        } finally {server.stop(0);}
    }
}
