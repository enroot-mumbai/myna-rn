package com.mynarnapp;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.RemoteException;
import android.util.Log;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

public class InstallReferrer extends ReactContextBaseJavaModule {
    private static final String TAG = "InstallReferrer";
    private final ReactApplicationContext reactContext;
    private static final String PREFS_NAME = "ReferrerPrefs";
    private static final String REFERRER_KEY = "installReferrer";
    private static final String REFERRER_CLICK_TIME_KEY = "referrerClickTime";
    private static final String INSTALL_BEGIN_TIME_KEY = "installBeginTime";
    private static final String REFERRER_TIMESTAMP_KEY = "referrerTimestamp";

    public InstallReferrer(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "InstallReferrer";
    }

    // Store referrer data in SharedPreferences
    private void storeReferrerData(String referrer, long clickTime, long beginTime) {
        SharedPreferences prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString(REFERRER_KEY, referrer);
        editor.putLong(REFERRER_CLICK_TIME_KEY, clickTime);
        editor.putLong(INSTALL_BEGIN_TIME_KEY, beginTime);
        editor.putLong(REFERRER_TIMESTAMP_KEY, System.currentTimeMillis());
        editor.apply();
        
        Log.d(TAG, "Stored referrer data: " + referrer);
    }

    // Get stored referrer data
    private WritableMap getStoredReferrerData() {
        SharedPreferences prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String referrer = prefs.getString(REFERRER_KEY, null);
        long clickTime = prefs.getLong(REFERRER_CLICK_TIME_KEY, 0);
        long beginTime = prefs.getLong(INSTALL_BEGIN_TIME_KEY, 0);
        long timestamp = prefs.getLong(REFERRER_TIMESTAMP_KEY, 0);
        
        WritableMap result = Arguments.createMap();
        
        if (referrer != null) {
            result.putString("installReferrer", referrer);
            result.putDouble("referrerClickTimestampSeconds", clickTime);
            result.putDouble("installBeginTimestampSeconds", beginTime);
            result.putDouble("storedTimestamp", timestamp);
            
            // Check if referrer is still valid (less than 90 days old)
            long referrerAge = System.currentTimeMillis() - timestamp;
            long ninetyDaysInMs = 90 * 24 * 60 * 60 * 1000;
            result.putBoolean("isValid", referrerAge < ninetyDaysInMs);
            
            Log.d(TAG, "Retrieved stored referrer: " + referrer);
        }
        
        return result;
    }

    @ReactMethod
    public void getReferrer(Promise promise) {
        Log.d(TAG, "Getting install referrer...");
        
        // First check if we have stored referrer data
        WritableMap storedData = getStoredReferrerData();
        if (storedData.hasKey("installReferrer") && storedData.getBoolean("isValid")) {
            Log.d(TAG, "Using stored referrer data");
            promise.resolve(storedData);
            return;
        }
        
        // If no stored data or it's expired, try to get fresh data
        InstallReferrerClient referrerClient = InstallReferrerClient.newBuilder(reactContext).build();
        
        referrerClient.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                WritableMap result = Arguments.createMap();
                
                Log.d(TAG, "Install referrer setup finished with code: " + responseCode);
                
                switch (responseCode) {
                    case InstallReferrerClient.InstallReferrerResponse.OK:
                        try {
                            ReferrerDetails response = referrerClient.getInstallReferrer();
                            String referrerUrl = response.getInstallReferrer();
                            long referrerClickTime = response.getReferrerClickTimestampSeconds();
                            long appInstallTime = response.getInstallBeginTimestampSeconds();
                            
                            Log.d(TAG, "Referrer URL: " + referrerUrl);
                            Log.d(TAG, "Referrer click time: " + referrerClickTime);
                            Log.d(TAG, "App install time: " + appInstallTime);
                            
                            // Store the referrer data for future use
                            storeReferrerData(referrerUrl, referrerClickTime, appInstallTime);
                            
                            result.putString("installReferrer", referrerUrl);
                            result.putDouble("referrerClickTimestampSeconds", referrerClickTime);
                            result.putDouble("installBeginTimestampSeconds", appInstallTime);
                            result.putBoolean("isValid", true);
                            
                            promise.resolve(result);
                        } catch (RemoteException e) {
                            Log.e(TAG, "Error getting referrer: " + e.getMessage());
                            promise.reject("REFERRER_ERROR", "Error getting referrer: " + e.getMessage());
                        }
                        break;
                    case InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED:
                        Log.e(TAG, "Install Referrer not supported");
                        promise.reject("NOT_SUPPORTED", "Install Referrer not supported");
                        break;
                    case InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE:
                        Log.e(TAG, "Install Referrer service unavailable");
                        promise.reject("SERVICE_UNAVAILABLE", "Install Referrer service unavailable");
                        break;
                    default:
                        Log.e(TAG, "Install Referrer connection failed with code: " + responseCode);
                        promise.reject("CONNECTION_FAILED", "Install Referrer connection failed with code: " + responseCode);
                        break;
                }
                
                referrerClient.endConnection();
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                Log.e(TAG, "Install Referrer service disconnected");
                // Connection was lost, you can retry if needed
            }
        });
    }

    @ReactMethod
    public void clearStoredReferrer(Promise promise) {
        SharedPreferences prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.clear();
        editor.apply();
        
        Log.d(TAG, "Cleared stored referrer data");
        promise.resolve(true);
    }
} 