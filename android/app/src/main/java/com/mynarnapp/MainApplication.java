package com.mynarnapp;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.config.ReactFeatureFlags;
import com.facebook.soloader.SoLoader;
import com.mynarnapp.newarchitecture.MainApplicationReactNativeHost;
import java.lang.reflect.InvocationTargetException;
import java.util.List;
import com.mynarnapp.InstallReferrerPackage;
import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;
import android.util.Log;

public class MainApplication extends Application implements ReactApplication {

  private final ReactNativeHost mReactNativeHost =
      new ReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // packages.add(new MyReactNativePackage());
          packages.add(new InstallReferrerPackage());
          return packages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }
      };

  private final ReactNativeHost mNewArchitectureNativeHost =
      new MainApplicationReactNativeHost(this);

  @Override
  public ReactNativeHost getReactNativeHost() {
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      return mNewArchitectureNativeHost;
    } else {
      return mReactNativeHost;
    }
  }

  @Override
  public void onCreate() {
    super.onCreate();
    // If you opted-in for the New Architecture, we enable the TurboModule system
    ReactFeatureFlags.useTurboModules = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
    SoLoader.init(this, /* native exopackage */ false);
    initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
    
    // Initialize the Install Referrer API
    initializeInstallReferrer();
  }

  private void initializeInstallReferrer() {
    Log.d("MainApplication", "Initializing Install Referrer API");
    
    InstallReferrerClient referrerClient = InstallReferrerClient.newBuilder(this).build();
    referrerClient.startConnection(new InstallReferrerStateListener() {
        @Override
        public void onInstallReferrerSetupFinished(int responseCode) {
            Log.d("MainApplication", "Install Referrer setup finished with code: " + responseCode);
            
            if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                Log.d("MainApplication", "Install Referrer API connected successfully");
                
                // Try to get the referrer directly and store it
                try {
                    ReferrerDetails response = referrerClient.getInstallReferrer();
                    String referrerUrl = response.getInstallReferrer();
                    long referrerClickTime = response.getReferrerClickTimestampSeconds();
                    long appInstallTime = response.getInstallBeginTimestampSeconds();
                    
                    Log.d("MainApplication", "Direct referrer check - URL: " + referrerUrl);
                    Log.d("MainApplication", "Direct referrer check - Click time: " + referrerClickTime);
                    Log.d("MainApplication", "Direct referrer check - Install time: " + appInstallTime);
                    
                    // Store the referrer in SharedPreferences
                    SharedPreferences prefs = getSharedPreferences("ReferrerPrefs", Context.MODE_PRIVATE);
                    SharedPreferences.Editor editor = prefs.edit();
                    editor.putString("installReferrer", referrerUrl);
                    editor.putLong("referrerClickTime", referrerClickTime);
                    editor.putLong("installBeginTime", appInstallTime);
                    editor.putLong("referrerTimestamp", System.currentTimeMillis());
                    editor.apply();
                    
                    Log.d("MainApplication", "Stored referrer data in SharedPreferences");
                } catch (Exception e) {
                    Log.e("MainApplication", "Error getting referrer directly: " + e.getMessage());
                }
            } else {
                Log.e("MainApplication", "Install Referrer API connection failed with code: " + responseCode);
            }
        }

        @Override
        public void onInstallReferrerServiceDisconnected() {
            Log.e("MainApplication", "Install Referrer service disconnected");
        }
    });
  }

  /**
   * Loads Flipper in React Native templates. Call this in the onCreate method with something like
   * initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
   *
   * @param context
   * @param reactInstanceManager
   */
  private static void initializeFlipper(
      Context context, ReactInstanceManager reactInstanceManager) {
    if (BuildConfig.DEBUG) {
      try {
        /*
         We use reflection here to pick up the class that initializes Flipper,
        since Flipper library is not available in release mode
        */
        Class<?> aClass = Class.forName("com.mynarnapp.ReactNativeFlipper");
        aClass
            .getMethod("initializeFlipper", Context.class, ReactInstanceManager.class)
            .invoke(null, context, reactInstanceManager);
      } catch (ClassNotFoundException e) {
        e.printStackTrace();
      } catch (NoSuchMethodException e) {
        e.printStackTrace();
      } catch (IllegalAccessException e) {
        e.printStackTrace();
      } catch (InvocationTargetException e) {
        e.printStackTrace();
      }
    }
  }
}
