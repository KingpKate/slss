package com.slss.service;

import com.slss.domain.LoginCaptchaChallenge;
import com.slss.domain.SystemSetting;
import com.slss.repository.LoginCaptchaChallengeRepository;
import com.slss.repository.SystemSettingRepository;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CaptchaServiceTest {
  @Test
  void statusUsesConfiguredThresholdAndDoesNotRequireChallengeBeforeThreshold() {
    var repo = mock(LoginCaptchaChallengeRepository.class);
    var settings = mock(SystemSettingRepository.class);
    when(settings.findById("login.captcha.enabled")).thenReturn(Optional.of(setting("true")));
    when(settings.findById("login.captcha.triggerAfterFailures")).thenReturn(Optional.of(setting("3")));

    var service = new CaptchaService(repo, settings);
    assertFalse(service.status("001", 2L).required());
    assertTrue(service.status("001", 3L).required());
    assertEquals(3, service.status("001", 3L).triggerAfterFailures());
  }

  @Test
  void validCaptchaIsSingleUseAndWrongAnswersConsumeAttempts() {
    var repo = mock(LoginCaptchaChallengeRepository.class);
    var settings = mock(SystemSettingRepository.class);
    when(settings.findById(any())).thenReturn(Optional.empty());
    var service = new CaptchaService(repo, settings);
    var challenge = challenge("001", "127.0.0.1", "A7KQ", Instant.now().plusSeconds(120), 5);
    when(repo.findById("token")).thenReturn(Optional.of(challenge));

    assertFalse(service.verify("token", "001", "127.0.0.1", "WRONG"));
    assertTrue(service.verify("token", "001", "127.0.0.1", "A7KQ"));
    assertFalse(service.verify("token", "001", "127.0.0.1", "A7KQ"));
    verify(repo, atLeast(2)).save(challenge);
  }

  @Test
  void expiredCaptchaAndDifferentIdentityAreRejected() {
    var repo = mock(LoginCaptchaChallengeRepository.class);
    var settings = mock(SystemSettingRepository.class);
    when(settings.findById(any())).thenReturn(Optional.empty());
    var service = new CaptchaService(repo, settings);
    var expired = challenge("001", "127.0.0.1", "A7KQ", Instant.now().minusSeconds(1), 5);
    when(repo.findById("token")).thenReturn(Optional.of(expired));

    assertFalse(service.verify("token", "001", "127.0.0.1", "A7KQ"));
    assertFalse(service.verify("token", "002", "127.0.0.1", "A7KQ"));
  }

  private static LoginCaptchaChallenge challenge(String user, String ip, String answer, Instant expires, int maxAttempts) {
    var value = new LoginCaptchaChallenge();
    value.setId("token");
    value.setUsername(user);
    value.setIpAddress(ip);
    value.setAnswerHash(hash(answer));
    value.setExpiresAt(expires);
    value.setMaxAttempts(maxAttempts);
    return value;
  }

  private static String hash(String value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new AssertionError(e);
    }
  }

  private static SystemSetting setting(String value) {
    var setting = new SystemSetting();
    setting.setSettingValue(value);
    return setting;
  }
}
