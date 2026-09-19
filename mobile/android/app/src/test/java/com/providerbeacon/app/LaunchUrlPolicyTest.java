package com.providerbeacon.app;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class LaunchUrlPolicyTest {
    @Test public void retainsComparisonAndNotificationDestinations() {
        String comparison = "https://providerbeacon.com/compare?services=service-1,service-2&quantity=5000&currency=USD";
        assertEquals(comparison, LaunchUrlPolicy.resolve(comparison));
        String message = "https://providerbeacon.com/account?conversation=123";
        assertEquals(message, LaunchUrlPolicy.resolve(message));
    }

    @Test public void rejectsUntrustedAndMalformedIntents() {
        for (String value : new String[]{null, "http://providerbeacon.com/", "javascript:alert(1)",
                "https://providerbeacon.com.evil.test/", "https://evil.test/providerbeacon.com",
                "https://attacker@providerbeacon.com/", "https://providerbeacon.com:444/",
                "https://providerbeacon.com\\@evil.test/", "not a url"}) {
            assertEquals(LaunchUrlPolicy.DEFAULT_URL, LaunchUrlPolicy.resolve(value));
        }
    }
}
