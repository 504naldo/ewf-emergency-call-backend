# EAS Build Guide for EWF Emergency

This guide provides step-by-step instructions for building standalone Android APK and iOS builds using Expo Application Services (EAS).

## Prerequisites

1. **Expo Account** - Sign up at https://expo.dev if you don't have one
2. **EAS CLI** - Already configured in this project
3. **Expo Organization** - Create or join an organization for team builds

## Configuration Overview

### App Branding

- **App Name:** EWF Emergency
- **Bundle ID (iOS):** `space.manus.ewf.emergency.call.t20260206001445`
- **Package Name (Android):** `space.manus.ewf.emergency.call.t20260206001445`
- **App Icon:** Custom EWF logo (configured in `assets/images/icon.png`)
- **Splash Screen:** EWF logo on white/black background

### Build Profiles

The project includes three build profiles in `eas.json`:

#### 1. Development Profile
- **Purpose:** Local development with Expo Dev Client
- **Distribution:** Internal
- **Android:** APK with simulator support
- **iOS:** Simulator build

#### 2. Preview Profile (Internal Distribution)
- **Purpose:** Internal testing with real devices
- **Distribution:** Internal (no app store submission)
- **Android:** APK file (can be installed directly)
- **iOS:** Internal distribution (TestFlight or Ad Hoc)
- **API URL:** `https://3000-idnp2v40w08yb7xd2bav5-40469c99.us2.manus.computer`

#### 3. Production Profile (App Store)
- **Purpose:** App Store and Google Play distribution
- **Distribution:** Store
- **Android:** AAB (Android App Bundle)
- **iOS:** App Store build
- **API URL:** `https://your-production-api-url.com` (update before production build)

## Environment Variables

The app uses `EXPO_PUBLIC_API_URL` to configure the backend API endpoint:

- **Preview builds:** Points to sandbox API server
- **Production builds:** Points to production API server

**Important:** Update the production API URL in `eas.json` before building for production:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-production-api-url.com"
      }
    }
  }
}
```

## Step-by-Step Build Instructions

### Initial Setup

#### 1. Log in to Expo

```bash
cd /home/ubuntu/ewf-emergency-call
npx eas-cli login
```

Enter your Expo account credentials when prompted.

#### 2. Configure the Project

```bash
npx eas-cli build:configure
```

This command:
- Links the project to your Expo account
- Creates or updates `eas.json`
- Sets up project slug and owner

**Select options:**
- **Project slug:** ewf-emergency-call (or your preferred slug)
- **Owner:** Your Expo username or organization

### Building Android APK (Preview)

#### 1. Start the Build

```bash
npx eas-cli build --platform android --profile preview
```

**What happens:**
1. EAS uploads your project code
2. Builds Android APK with preview configuration
3. API URL is set to sandbox server
4. Build runs on Expo's cloud infrastructure

#### 2. Monitor Build Progress

The CLI will display a build URL. You can:
- Watch progress in the terminal
- Open the URL in browser to see detailed logs
- Receive email notification when build completes

#### 3. Download the APK

When the build completes:

```bash
# Download directly from CLI
npx eas-cli build:download --platform android --profile preview

# Or download from the build URL in browser
```

The APK will be saved to your current directory.

#### 4. Distribute to Testers

**Option A: Direct Installation**
1. Send APK file to testers via email, Slack, or file sharing
2. Testers enable "Install from Unknown Sources" on Android
3. Testers download and install the APK

**Option B: Internal Distribution**
1. Upload APK to Expo's internal distribution
2. Share distribution link with testers
3. Testers install from link

```bash
npx eas-cli build:submit --platform android --profile preview
```

### Building iOS (TestFlight)

#### 1. Apple Developer Account Setup

**Requirements:**
- Apple Developer account ($99/year)
- App ID registered in Apple Developer Portal
- Distribution certificate and provisioning profile

**Automatic Setup (Recommended):**

EAS can automatically create certificates and profiles:

```bash
npx eas-cli build --platform ios --profile preview
```

When prompted:
- **Generate new credentials?** Yes
- **Apple ID:** Your Apple Developer account email
- **App-specific password:** Generate at https://appleid.apple.com

**Manual Setup:**

If you prefer manual certificate management:
1. Go to https://developer.apple.com
2. Create App ID: `space.manus.ewf.emergency.call.t20260206001445`
3. Create Distribution Certificate
4. Create Provisioning Profile (Ad Hoc or App Store)
5. Upload to EAS:

```bash
npx eas-cli credentials
```

#### 2. Start the Build

```bash
npx eas-cli build --platform ios --profile preview
```

**Build process:**
1. EAS uploads project code
2. Installs dependencies
3. Compiles iOS app with preview configuration
4. Signs with distribution certificate
5. Generates IPA file

#### 3. Submit to TestFlight

After the build completes, submit to TestFlight:

```bash
npx eas-cli submit --platform ios --profile preview
```

**What happens:**
1. EAS uploads IPA to App Store Connect
2. Apple processes the build (10-30 minutes)
3. Build appears in TestFlight
4. You can add internal/external testers

#### 4. Add Testers in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Select your app
3. Go to TestFlight tab
4. Add internal testers (up to 100)
5. Add external testers (up to 10,000, requires beta review)

Testers receive email invitation to install via TestFlight app.

### Building for Production

#### 1. Update Production API URL

Edit `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.ewf.com"
      }
    }
  }
}
```

#### 2. Build Android AAB

```bash
npx eas-cli build --platform android --profile production
```

This creates an Android App Bundle (AAB) for Google Play.

#### 3. Build iOS for App Store

```bash
npx eas-cli build --platform ios --profile production
```

This creates an IPA for App Store submission.

#### 4. Submit to Stores

**Google Play:**

```bash
npx eas-cli submit --platform android --profile production
```

You'll need:
- Google Play Developer account ($25 one-time fee)
- App created in Google Play Console
- Service account JSON key

**Apple App Store:**

```bash
npx eas-cli submit --platform ios --profile production
```

You'll need:
- Apple Developer account
- App created in App Store Connect
- App Store submission ready (screenshots, description, etc.)

## Build Commands Reference

### Check Build Status

```bash
# List all builds
npx eas-cli build:list

# View specific build
npx eas-cli build:view <build-id>
```

### Download Builds

```bash
# Download latest build
npx eas-cli build:download --platform android --profile preview

# Download specific build
npx eas-cli build:download --id <build-id>
```

### Cancel Build

```bash
npx eas-cli build:cancel <build-id>
```

### View Credentials

```bash
npx eas-cli credentials
```

## Troubleshooting

### Issue: Build fails with "Missing credentials"

**Solution:**
```bash
npx eas-cli credentials
```

Select "Set up credentials" and follow prompts.

### Issue: iOS build fails with "Provisioning profile doesn't match"

**Solution:**
1. Delete existing credentials:
```bash
npx eas-cli credentials
```
2. Select "Remove credentials"
3. Rebuild and let EAS generate new ones

### Issue: Android build fails with "Duplicate resources"

**Solution:**
Check `android/app/build.gradle` for duplicate dependencies.

### Issue: App crashes on launch in standalone build

**Possible causes:**
1. **Missing environment variables** - Check `EXPO_PUBLIC_API_URL` is set in `eas.json`
2. **API URL not accessible** - Ensure production API is publicly accessible
3. **Certificate mismatch** - Rebuild with correct credentials

**Debug steps:**
1. Check build logs in EAS dashboard
2. Test with preview build first
3. Enable crash reporting (Sentry, Bugsnag)

### Issue: Authentication doesn't work in standalone build

**Solution:**

Verify deep linking is configured correctly:

1. Check `app.config.ts` has correct scheme
2. Test OAuth callback URL:
   - iOS: `manus20260206001445://oauth/callback`
   - Android: `manus20260206001445://oauth/callback`
3. Ensure backend accepts these redirect URIs

## Testing Checklist

Before distributing builds to users:

- [ ] Test login flow (OAuth)
- [ ] Test API calls (tRPC endpoints)
- [ ] Test push notifications
- [ ] Test deep linking
- [ ] Test on both iOS and Android
- [ ] Test on different device sizes
- [ ] Test offline behavior
- [ ] Test app icon and splash screen
- [ ] Verify app name displays correctly
- [ ] Test logout and re-login

## Distribution Workflow

### Internal Testing (Preview Builds)

1. Build with preview profile
2. Download APK/IPA
3. Distribute to internal testers:
   - Android: Share APK directly
   - iOS: TestFlight internal testing
4. Collect feedback
5. Fix issues and rebuild

### Beta Testing (Preview Builds)

1. Build with preview profile
2. Submit to TestFlight (iOS) or Google Play Internal Testing (Android)
3. Add external testers
4. Collect feedback and crash reports
5. Iterate until stable

### Production Release

1. Update production API URL in `eas.json`
2. Build with production profile
3. Submit to App Store and Google Play
4. Wait for review (1-7 days)
5. Release to public

## Cost Considerations

### EAS Build Pricing

- **Free tier:** 30 builds/month
- **Production tier:** $29/month (unlimited builds)
- **Enterprise tier:** Custom pricing

### App Store Fees

- **Apple Developer:** $99/year
- **Google Play Developer:** $25 one-time

## Best Practices

1. **Use preview builds for testing** - Don't waste production builds on testing
2. **Test on real devices** - Simulators don't catch all issues
3. **Version your builds** - Increment version in `app.config.ts` for each build
4. **Keep credentials secure** - Don't commit credentials to git
5. **Monitor build logs** - Check for warnings and errors
6. **Test API connectivity** - Ensure production API is accessible before building
7. **Use semantic versioning** - e.g., 1.0.0, 1.0.1, 1.1.0
8. **Document changes** - Keep changelog for each version

## Next Steps

After successful builds:

1. **Set up crash reporting** - Integrate Sentry or Bugsnag
2. **Set up analytics** - Track user behavior and app usage
3. **Set up CI/CD** - Automate builds with GitHub Actions
4. **Set up OTA updates** - Use Expo Updates for quick fixes
5. **Plan release schedule** - Regular updates keep users engaged

## Support

- **EAS Documentation:** https://docs.expo.dev/build/introduction/
- **Expo Forums:** https://forums.expo.dev/
- **Discord:** https://chat.expo.dev/
