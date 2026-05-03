# Requirements Document

## Introduction

A production-grade, web-based video downloader for personal use. The tool provides a clean, ad-free interface that lets users download videos from a wide range of social media and video-hosting platforms — including Instagram, X (Twitter), TikTok, YouTube, Facebook, Reddit, Vimeo, Twitch, Pinterest, LinkedIn, and others. Each supported platform has a dedicated route (e.g., `/youtube`, `/instagram`, `/tiktok`) with platform-specific options. The system is self-hosted, technically excellent, and designed for reliability, speed, and ease of use.

---

## Glossary

- **Downloader**: The web application described in this document.
- **User**: The person operating the Downloader in a browser.
- **Platform**: A third-party video-hosting or social media service (e.g., YouTube, Instagram, TikTok).
- **Platform Route**: A dedicated URL path scoped to a single Platform (e.g., `/youtube`).
- **URL**: A valid, fully-qualified web address submitted by the User pointing to a video on a Platform.
- **Media Item**: A single downloadable video, audio track, or combined stream resolved from a URL.
- **Format**: A specific encoding and container combination for a Media Item (e.g., MP4/H.264, WebM/VP9, MP3).
- **Quality**: A resolution or bitrate tier for a Media Item (e.g., 1080p, 720p, 320 kbps).
- **Download Job**: A server-side task that fetches, processes, and prepares a Media Item for delivery.
- **Progress Indicator**: A UI element that communicates the current state and percentage completion of a Download Job.
- **Metadata**: Descriptive information about a Media Item, including title, duration, thumbnail URL, available formats, and available qualities.
- **Extractor**: The server-side component responsible for resolving a URL into Metadata and download streams for a specific Platform.
- **Queue**: The server-side list of pending and active Download Jobs.
- **Rate Limiter**: A server-side mechanism that restricts the number of requests from a single client within a time window.
- **Sanitized Filename**: A filename derived from Metadata with characters illegal on common filesystems removed or replaced.
- **Turnstile**: Cloudflare's invisible CAPTCHA widget that verifies a request originates from a human browser without requiring user interaction.

---

## Requirements

### Requirement 1: Platform-Specific Routes

**User Story:** As a User, I want a dedicated page for each supported Platform, so that I can access platform-specific options and instructions without confusion.

#### Acceptance Criteria

1. THE Downloader SHALL expose a dedicated Platform Route for each supported Platform: `/youtube`, `/instagram`, `/tiktok`, `/twitter`, `/facebook`, `/reddit`, `/vimeo`, `/twitch`, `/pinterest`, `/linkedin`, and `/dailymotion`.
2. WHEN a User navigates to a Platform Route, THE Downloader SHALL display a page scoped to that Platform, including its name, logo, accepted URL formats, and available options.
3. WHEN a User navigates to the root path `/`, THE Downloader SHALL display a universal download page that accepts URLs from any supported Platform.
4. IF a User navigates to an unrecognised route, THEN THE Downloader SHALL return an HTTP 404 response and display a helpful error page with a link back to `/`.

---

### Requirement 2: URL Submission and Validation

**User Story:** As a User, I want to paste a video URL and have it validated immediately, so that I know whether the link is supported before waiting for a download.

#### Acceptance Criteria

1. WHEN a User submits a URL, THE Downloader SHALL validate that the URL is well-formed and matches a known Platform pattern before initiating any network request.
2. IF a submitted URL is malformed or does not match any supported Platform pattern, THEN THE Downloader SHALL display an inline validation error within 100 ms of submission without making any server-side request.
3. WHEN a valid URL is submitted on a Platform Route, THE Downloader SHALL reject URLs that do not belong to that Platform and display a descriptive error message identifying the mismatch.
4. THE Downloader SHALL accept URLs using both `http` and `https` schemes and normalise them to `https` before processing.
5. WHEN a URL contains tracking parameters (e.g., UTM parameters, referral tokens), THE Downloader SHALL strip those parameters before passing the URL to the Extractor.

---

### Requirement 3: Metadata Retrieval

**User Story:** As a User, I want to see the video title, thumbnail, duration, and available quality options before downloading, so that I can make an informed choice.

#### Acceptance Criteria

1. WHEN a valid URL is submitted, THE Downloader SHALL retrieve Metadata for the corresponding Media Item and display it within 5 seconds under normal network conditions.
2. THE Downloader SHALL display the Media Item title, thumbnail image, duration, uploader name, and a list of available Formats and Qualities.
3. WHILE Metadata is being retrieved, THE Downloader SHALL display a loading indicator to the User.
4. IF Metadata retrieval fails due to a network error, THEN THE Downloader SHALL display an error message describing the failure and offer a retry action.
5. IF a URL points to a private, deleted, or geo-restricted Media Item, THEN THE Downloader SHALL display a descriptive error message explaining why the Media Item is unavailable.
6. IF a URL points to a playlist or channel rather than a single video, THEN THE Downloader SHALL display the first Media Item's Metadata and inform the User that only single-video downloads are supported on that route.

---

### Requirement 4: Format and Quality Selection

**User Story:** As a User, I want to choose the format and quality of the video I download, so that I get the file that best suits my needs.

#### Acceptance Criteria

1. WHEN Metadata is displayed, THE Downloader SHALL present all available Formats and Qualities as selectable options.
2. THE Downloader SHALL pre-select the highest available video Quality and the MP4 Format as the default selection.
3. WHERE audio-only download is supported by the Platform, THE Downloader SHALL offer an audio-only option that produces an MP3 or M4A file.
4. WHEN a User selects a Format or Quality, THE Downloader SHALL update the estimated file size display within 200 ms without reloading the page.
5. THE Downloader SHALL clearly label Formats and Qualities using human-readable strings (e.g., "1080p MP4", "720p WebM", "Audio only MP3").

---

### Requirement 5: Download Execution

**User Story:** As a User, I want to start a download with a single click and receive the file directly in my browser, so that the process is fast and straightforward.

#### Acceptance Criteria

1. WHEN a User initiates a download, THE Downloader SHALL create a Download Job and begin processing within 500 ms.
2. WHILE a Download Job is active, THE Downloader SHALL display a Progress Indicator showing the current percentage and estimated time remaining, updated at intervals of no more than 2 seconds.
3. WHEN a Download Job completes, THE Downloader SHALL deliver the file to the User's browser as a download with a Sanitized Filename derived from the Media Item title and selected Format.
4. THE Downloader SHALL set the `Content-Disposition` response header to `attachment` with the Sanitized Filename so that the browser triggers a file-save dialog.
5. IF a Download Job fails after initiation, THEN THE Downloader SHALL display an error message and offer the User a retry action without requiring the URL to be re-entered.
6. THE Downloader SHALL support concurrent Download Jobs up to a configurable maximum (default: 3 per client IP address).

---

### Requirement 6: YouTube-Specific Features

**User Story:** As a User downloading from YouTube, I want access to YouTube-specific options such as subtitle download and age-restricted content handling, so that I can get exactly what I need.

#### Acceptance Criteria

1. WHEN a YouTube URL is submitted, THE Downloader SHALL support Qualities up to the highest available resolution, including 4K (2160p) where the video provides it.
2. WHERE a YouTube video has available subtitles, THE Downloader SHALL list the available subtitle languages and allow the User to download subtitles as a separate `.srt` or `.vtt` file.
3. WHEN a YouTube video is age-restricted, THE Downloader SHALL attempt to retrieve it using configured credentials and, IF credentials are absent or invalid, THEN THE Downloader SHALL display a descriptive error message.
4. THE Downloader SHALL support YouTube Shorts URLs in addition to standard watch URLs.

---

### Requirement 7: Instagram-Specific Features

**User Story:** As a User downloading from Instagram, I want to download Reels, posts, and Stories, so that I can save content from all Instagram content types.

#### Acceptance Criteria

1. WHEN an Instagram Reel URL is submitted, THE Downloader SHALL resolve and download the video at the highest available Quality.
2. WHEN an Instagram post URL containing multiple media items is submitted, THE Downloader SHALL display all media items in the post and allow the User to select which ones to download.
3. WHEN an Instagram Story URL is submitted, THE Downloader SHALL attempt to retrieve the Story and, IF the Story has expired or belongs to a private account, THEN THE Downloader SHALL display a descriptive error message.

---

### Requirement 8: TikTok-Specific Features

**User Story:** As a User downloading from TikTok, I want to download videos with or without the TikTok watermark, so that I have control over the output.

#### Acceptance Criteria

1. WHEN a TikTok URL is submitted, THE Downloader SHALL offer the User the option to download the video with or without the TikTok watermark.
2. THE Downloader SHALL support both standard TikTok URLs and shortened `vm.tiktok.com` URLs.
3. WHEN a TikTok video is unavailable due to regional restrictions, THE Downloader SHALL display a descriptive error message.

---

### Requirement 9: X (Twitter) Specific Features

**User Story:** As a User downloading from X (Twitter), I want to download videos from tweets, so that I can save video content shared on the platform.

#### Acceptance Criteria

1. WHEN an X (Twitter) tweet URL containing a video is submitted, THE Downloader SHALL resolve all available Quality variants and present them for selection.
2. IF a tweet does not contain a video or GIF, THEN THE Downloader SHALL display a descriptive error message indicating no downloadable media was found.
3. THE Downloader SHALL support both `twitter.com` and `x.com` URL formats.

---

### Requirement 10: Ad-Free and Clean Interface

**User Story:** As a User, I want an interface free of advertisements and distracting elements, so that I can focus on downloading without interruption.

#### Acceptance Criteria

1. THE Downloader SHALL not display any third-party advertisements, sponsored content, or affiliate links anywhere in the interface.
2. THE Downloader SHALL not embed any third-party analytics, tracking pixels, or fingerprinting scripts.
3. THE Downloader SHALL load the initial page within 2 seconds on a standard broadband connection (≥ 10 Mbps) as measured by Largest Contentful Paint (LCP).
4. THE Downloader SHALL achieve a Lighthouse performance score of 90 or above on desktop.

---

### Requirement 11: Rate Limiting and Abuse Prevention

**User Story:** As a system operator, I want the Downloader to enforce rate limits, so that the server is protected from abuse and remains available for legitimate use.

#### Acceptance Criteria

1. THE Rate Limiter SHALL restrict each client IP address to a maximum of 20 URL submissions per minute.
2. IF a client IP address exceeds the submission limit, THEN THE Downloader SHALL return an HTTP 429 response with a `Retry-After` header indicating when the limit resets.
3. THE Rate Limiter SHALL restrict each client IP address to a maximum of 5 concurrent Download Jobs.
4. THE Downloader SHALL log each rate-limit violation with the client IP address, timestamp, and request path.

---

### Requirement 12: Error Handling and Resilience

**User Story:** As a User, I want clear error messages when something goes wrong, so that I understand what happened and what I can do next.

#### Acceptance Criteria

1. WHEN any server-side error occurs during a Download Job, THE Downloader SHALL log the full error details server-side and display a user-friendly message that does not expose internal stack traces or system paths.
2. IF the Extractor for a Platform is temporarily unavailable, THEN THE Downloader SHALL display a message indicating the Platform is temporarily unavailable and suggest retrying later.
3. THE Downloader SHALL handle Extractor timeouts by cancelling the Download Job after 60 seconds of inactivity and notifying the User.
4. WHEN a Download Job is cancelled by the User, THE Downloader SHALL release all associated server-side resources within 5 seconds.

---

### Requirement 13: Security

**User Story:** As a system operator, I want the Downloader to be secure by default, so that it cannot be used as a proxy for malicious activity or expose the server to attack.

#### Acceptance Criteria

1. THE Downloader SHALL validate and sanitize all user-supplied input on the server side before passing it to any Extractor or shell command.
2. THE Downloader SHALL not execute arbitrary shell commands constructed from unsanitized user input.
3. THE Downloader SHALL set the following HTTP security headers on all responses: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.
4. THE Downloader SHALL restrict outbound Extractor requests to URLs matching known Platform domains and SHALL reject URLs resolving to private IP ranges (RFC 1918) or loopback addresses.
5. WHEN a downloaded file is served to the User, THE Downloader SHALL delete the temporary server-side file within 60 seconds of successful delivery.

---

### Requirement 14: Bot Protection via Cloudflare Turnstile

**User Story:** As a system operator, I want every download request to be verified as coming from a real browser, so that automated bots cannot abuse the download service.

#### Acceptance Criteria

1. THE Downloader SHALL embed a Cloudflare Turnstile widget on every page containing a download action.
2. WHEN a User initiates a download, THE Downloader SHALL require a valid Turnstile token to be present in the request before creating a Download Job.
3. THE Downloader SHALL verify the Turnstile token server-side by calling the Cloudflare Turnstile verification API before processing any download request.
4. IF the Turnstile token is absent, invalid, or already used, THEN THE Downloader SHALL return an HTTP 403 response and SHALL NOT create a Download Job.
5. THE Turnstile widget SHALL operate in invisible mode so that human users experience no interruption or puzzle challenge during normal use.
6. THE Downloader SHALL read the Turnstile site key and secret key from environment variables and SHALL NOT hardcode them in source code.
7. THE Downloader SHALL NOT require Turnstile verification for the metadata fetch (`/api/info`) endpoint, only for the download initiation (`/api/download`) endpoint.

---

### Requirement 15: Configuration and Extensibility

**User Story:** As a system operator, I want the Downloader to be configurable via environment variables, so that I can deploy it in different environments without modifying source code.

#### Acceptance Criteria

1. THE Downloader SHALL read all environment-specific settings — including port, maximum concurrent jobs, rate-limit thresholds, temporary file storage path, and optional Platform credentials — from environment variables at startup.
2. IF a required environment variable is absent at startup, THEN THE Downloader SHALL log a descriptive error message and exit with a non-zero status code.
3. THE Downloader SHALL expose a `/health` endpoint that returns HTTP 200 and a JSON body `{"status": "ok"}` when the service is running correctly.
4. WHERE a new Platform Extractor is added, THE Downloader SHALL register it by adding a single entry to a platform registry without requiring changes to the core routing or download logic.
