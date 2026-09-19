package com.providerbeacon.app;

import java.net.URI;
import java.net.URISyntaxException;

/** An exported activity must not accept arbitrary websites as a launch intent. */
final class LaunchUrlPolicy {
    static final String DEFAULT_URL = "https://providerbeacon.com/find?source=android";

    static String resolve(String candidate) {
        if (candidate == null) return DEFAULT_URL;
        try {
            URI uri = new URI(candidate);
            if ("https".equalsIgnoreCase(uri.getScheme())
                    && "providerbeacon.com".equalsIgnoreCase(uri.getHost())
                    && uri.getRawUserInfo() == null
                    && (uri.getPort() == -1 || uri.getPort() == 443)) {
                return candidate;
            }
        } catch (URISyntaxException ignored) {
            // An invalid or untrusted intent starts at search.
        }
        return DEFAULT_URL;
    }

    private LaunchUrlPolicy() {}
}
