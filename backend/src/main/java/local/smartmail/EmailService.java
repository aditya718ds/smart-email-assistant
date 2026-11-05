package local.smartmail;

import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EmailService {
    private final String mode, key, model;
    private final GeminiClient gemini = new GeminiClient();
    public EmailService(@Value("${assistant.mode}") String mode,
                        @Value("${assistant.gemini.api-key}") String key,
                        @Value("${assistant.gemini.model}") String model) {
        this.mode = mode.strip().toLowerCase(Locale.ROOT); this.key = key.strip(); this.model = model.strip();
        if (!this.mode.equals("demo") && !this.mode.equals("gemini"))
            throw new IllegalArgumentException("assistant.mode must be demo or gemini.");
    }
    public Map<String, Object> status() {
        return Map.of("mode", mode, "configured", mode.equals("demo") || !key.isBlank(),
                "model", mode.equals("demo") ? "Offline templates (not AI)" : model);
    }
    public Map<String, String> generate(EmailRequest email) {
        if (mode.equals("gemini") && key.isBlank()) throw new ApiException(503,
                "Add your Gemini API key to config.properties, then restart the app. See SETUP_GUIDE.html.");
        return Map.of("reply", mode.equals("demo") ? demo(email) : gemini.generate(key, model, email),
                "mode", mode, "model", mode.equals("demo") ? "Offline templates (not AI)" : model);
    }
    private String demo(EmailRequest email) {
        String content = email.emailContent().toLowerCase(Locale.ROOT);
        String main;
        if (content.matches("(?s).*(interview|application|candidate).*"))
            main = "Thank you for the update on my application. I appreciate the opportunity to discuss the role. "
                    + "My availability is [add your available dates and times]. Please let me know which time works best.";
        else if (content.matches("(?s).*(meeting|schedule|call|discuss).*"))
            main = "Thank you for reaching out about arranging a discussion. My availability is [add your available dates and times]. "
                    + "Please share the agenda and preferred meeting format so I can prepare.";
        else if (content.matches("(?s).*(issue|problem|refund|support|order).*"))
            main = "Thank you for letting me know about the issue. I understand your concern. "
                    + "Could you share [the relevant reference number and details] so I can look into it and confirm the next steps?";
        else main = "Thank you for your email. I appreciate you sharing these details. "
                    + "[Add your response to the main points here.] Please let me know if there is anything else I should consider.";
        String opening = switch(email.effectiveTone()) { case "friendly" -> "Hi there,"; case "casual" -> "Hey,"; default -> "Hello,"; };
        String closing = switch(email.effectiveTone()) { case "friendly" -> "Warm regards,"; case "casual" -> "Thanks,"; default -> "Best regards,"; };
        return opening + "\n\n" + main + (email.notes().isBlank() ? "" : "\n\n[Your requested points: " + email.notes() + "]")
                + "\n\n" + closing + "\n" + email.signature();
    }
}
