package local.smartmail;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record EmailRequest(
        @NotBlank(message="Paste an email first.") @Size(max=20000, message="Email must be 20,000 characters or fewer.") String emailContent,
        @Pattern(regexp="professional|friendly|casual", message="Choose professional, friendly, or casual tone.") String tone,
        @Size(max=2000, message="Instructions must be 2,000 characters or fewer.") String instructions,
        @Size(max=80, message="Name must be 80 characters or fewer.") String senderName) {
    public String effectiveTone() { return tone == null ? "professional" : tone; }
    public String notes() { return instructions == null ? "" : instructions.strip(); }
    public String signature() { return senderName == null || senderName.isBlank() ? "[Your name]" : senderName.strip(); }
}
