package com.slss.api;
import org.junit.jupiter.api.Test; import static org.junit.jupiter.api.Assertions.*;
class HealthControllerTest { @Test void healthContainsOk(){var r=new HealthController().health();assertEquals("ok",r.get("status"));} }
