package com.mynarnapp;

import android.os.RemoteException;
import androidx.annotation.NonNull;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public class InstallReferrerModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public InstallReferrerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "InstallReferrer";
    }

    @ReactMethod
    public void getReferrer(final Promise promise) {
        final InstallReferrerClient referrerClient = InstallReferrerClient.newBuilder(reactContext).build();
        
        referrerClient.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                WritableMap result = Arguments.createMap();
                
                switch (responseCode) {
                    case InstallReferrerClient.InstallReferrerResponse.OK:
                        try {
                            ReferrerDetails response = referrerClient.getInstallReferrer();
                            String referrerUrl = response.getInstallReferrer();
                            long referrerClickTime = response.getReferrerClickTimestampSeconds();
                            long appInstallTime = response.getInstallBeginTimestampSeconds();
                            
                            result.putString("installReferrer", referrerUrl);
                            result.putDouble("referrerClickTimestampSeconds", referrerClickTime);
                            result.putDouble("installBeginTimestampSeconds", appInstallTime);
                            
                            promise.resolve(result);
                        } catch (RemoteException e) {
                            promise.reject("REFERRER_ERROR", "Error getting referrer: " + e.getMessage());
                        } finally {
                            referrerClient.endConnection();
                        }
                        break;
                    case InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED:
                        promise.reject("REFERRER_ERROR", "Install Referrer API not supported");
                        referrerClient.endConnection();
                        break;
                    case InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE:
                        promise.reject("REFERRER_ERROR", "Install Referrer service unavailable");
                        referrerClient.endConnection();
                        break;
                    default:
                        promise.reject("REFERRER_ERROR", "Unknown error with code: " + responseCode);
                        referrerClient.endConnection();
                        break;
                }
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                // Connection to service was lost
                promise.reject("REFERRER_ERROR", "Install Referrer service disconnected");
            }
        });
    }
} 