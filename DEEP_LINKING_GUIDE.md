# Deep Linking Guide - Myna App

## Overview
This guide covers the enhanced deep linking functionality with language support, smart first-time redirects, and comprehensive web URL handling.

## Features

### 1. Language Support in Play Store Referrer

#### Supported Languages
- `hindi` - Hindi language
- `english` - English language  
- `telugu` - Telugu language
- `marathi` - Marathi language

#### Play Store URL Format
```
https://play.google.com/store/apps/details?id=com.mynarnapp&referrer=program%3DProgramName%26route%3Dsignup%26language%3Dhindi  
```

#### URL Parameters
- `program`: Program name (e.g., "ProgramName")
- `route`: Target route (e.g., "signup") 
- `language`: Language preference (e.g., "hindi", "english", "telugu", "marathi")

#### Example URLs
```
# Hindi signup with program
https://play.google.com/store/apps/details?id=com.mynarnapp&referrer=program%3DWomenHealth%26route%3Dsignup%26language%3Dhindi

# English signup with program  
https://play.google.com/store/apps/details?id=com.mynarnapp&referrer=program%3DChildCare%26route%3Dsignup%26language%3Denglish

# Telugu signup with program
https://play.google.com/store/apps/details?id=com.mynarnapp&referrer=program%3DHealthcare%26route%3Dsignup%26language%3Dtelugu
```

### 2. Smart First-Time Redirect Logic

#### Behavior
- **First launch after install**: Opens signup page with program prefilled
- **Subsequent launches**: Does NOT open signup automatically
- **Logged-in users**: Signup page is bypassed unless explicitly navigated
- **Program data persistence**: Program name remains available for 90 days for form prefilling

#### Implementation Details
```typescript
// Check if this is first launch
const isFirstLaunch = await isFirstLaunch();
const isLoggedIn = await isUserLoggedIn();

// Only redirect to signup if it's first launch or user is not logged in
if ((!isLoggedIn || firstLaunch)) {
  // Redirect to signup with prefilled data
}
```

### 3. Web URL Deep Linking

#### Supported Web URLs
Any URL from `https://mynafe.vercel.app/*` will open in the app if installed.

#### Examples
```
# Physical health page
https://mynafe.vercel.app/learn/physical-health

# Profile page  
https://mynafe.vercel.app/profile

# Appointment page
https://mynafe.vercel.app/appointment

# Signup with program and language
https://mynafe.vercel.app/signup?program=WomenHealth&language=hindi
```

## Implementation Guide

### For Web Developers

#### Getting Stored Program Data
```javascript
// In your web page, call this function to get stored program data
window.getStoredProgram();

// Listen for the response
window.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'STORED_PROGRAM_RESPONSE') {
    const { program, language } = data.payload;
    
    // Use program and language data
    if (program) {
      // Prefill program field
      document.getElementById('program-field').value = program;
    }
    
    if (language) {
      // Set language preference
      setLanguage(language);
    }
  }
});
```

#### URL Parameters in Signup Page
The signup page will receive these parameters:
- `program`: Program name to prefill
- `language`: Language preference for the page

### For App Developers

#### Adding New Deep Link Routes
```typescript
// In handleDeepLink function, add new route handling
if (path === '/your-new-route') {
  let webViewUrl = `${WEB_URL}/your-new-route`;
  
  // Add any query parameters
  const params = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    params.append(key, value);
  });
  
  if (params.toString()) {
    webViewUrl += `?${params.toString()}`;
  }
  
  return webViewUrl;
}
```

## Testing

### Testing Play Store Referrer
```bash
# Install app with referrer data
adb shell am start \
  -W -a android.intent.action.VIEW \
  -d "market://details?id=com.mynarnapp&referrer=program%3DTestProgram%26route%3Dsignup%26language%3Dhindi" \
  com.android.vending
```

### Testing Deep Links  
```bash
# Test custom scheme
adb shell am start \
  -W -a android.intent.action.VIEW \
  -d "mynarnapp://signup?program=TestProgram&language=hindi" \
  com.mynarnapp

# Test web URL
adb shell am start \
  -W -a android.intent.action.VIEW \
  -d "https://mynafe.vercel.app/learn/physical-health" \
  com.mynarnapp
```

## Data Storage

### AsyncStorage Keys
- `app_has_launched`: Tracks if app has been launched before
- `referrer_program`: Stored program name (90-day expiry)
- `referrer_route`: Stored route (90-day expiry)  
- `referrer_language`: Stored language preference (90-day expiry)
- `referrer_timestamp`: Timestamp for expiry calculation

### Data Expiry
- Referrer data expires after 90 days
- Expired data is automatically cleaned up
- First launch flag persists until manually cleared

## Troubleshooting

### Common Issues

1. **App doesn't open on web URL click**
   - Ensure app is installed
   - Check Android intent filters in AndroidManifest.xml
   - Verify URL format matches expected pattern

2. **Program data not prefilling**
   - Check if referrer data is within 90-day window
   - Verify program parameter in original URL
   - Check AsyncStorage for stored data

3. **Language not applying**
   - Ensure language parameter is passed correctly
   - Check web page language handling
   - Verify supported language codes

### Debug Commands
```bash
# Check stored data
adb shell run-as com.mynarnapp cat /data/data/com.mynarnapp/databases/AsyncStorage

# Clear app data
adb shell pm clear com.mynarnapp

# View app logs
adb logcat | grep mynarnapp
```

## URL Encoding Reference

| Character | Encoded | Example |
|-----------|---------|---------|
| Space | %20 | `Women Health` → `Women%20Health` |
| & | %26 | `program=Test&route=signup` → `program%3DTest%26route%3Dsignup` |
| = | %3D | `program=Test` → `program%3DTest` |
| ? | %3F | `page?param=value` → `page%3Fparam%3Dvalue` |

## Best Practices

1. **Always URL encode parameters** in Play Store referrer URLs
2. **Test deep links thoroughly** on different Android versions
3. **Handle missing parameters gracefully** in web pages
4. **Implement fallback behavior** for unsupported deep link formats
5. **Monitor analytics** to track deep link usage and conversion rates 