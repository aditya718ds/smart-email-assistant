package local.smartmail;

import java.util.Map;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class EmailController {
    private final EmailService service;
    public EmailController(EmailService service) { this.service = service; }
    @GetMapping("/status") public Map<String, Object> status() { return service.status(); }
    @PostMapping("/email/generate") public Map<String, String> generate(@Valid @RequestBody EmailRequest email) {
        return service.generate(email);
    }
}
