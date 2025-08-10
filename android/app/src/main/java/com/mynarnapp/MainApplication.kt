package com.mynarnapp

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactInstanceManager
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.android.installreferrer.api.ReferrerDetails
import com.mynarnapp.InstallReferrerPackage

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
              add(InstallReferrerPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  override fun registerReceiver(receiver: BroadcastReceiver?, filter: IntentFilter?): Intent? {
    return if (Build.VERSION.SDK_INT >= 34 && applicationInfo.targetSdkVersion >= 34) {
      super.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      super.registerReceiver(receiver, filter)
    }
  }

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    
    initializeFlipper(this, reactNativeHost.reactInstanceManager)
    
    // Initialize the Install Referrer API
    initializeInstallReferrer()
  }

  private fun initializeInstallReferrer() {
    Log.d("MainApplication", "Initializing Install Referrer API")
    
    val referrerClient = InstallReferrerClient.newBuilder(this).build()
    referrerClient.startConnection(object : InstallReferrerStateListener {
      override fun onInstallReferrerSetupFinished(responseCode: Int) {
        Log.d("MainApplication", "Install Referrer setup finished with code: $responseCode")
        
        if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
          Log.d("MainApplication", "Install Referrer API connected successfully")
          
          // Try to get the referrer directly and store it
          try {
            val response = referrerClient.installReferrer
            val referrerUrl = response.installReferrer
            val referrerClickTime = response.referrerClickTimestampSeconds
            val appInstallTime = response.installBeginTimestampSeconds
            
            Log.d("MainApplication", "Direct referrer check - URL: $referrerUrl")
            Log.d("MainApplication", "Direct referrer check - Click time: $referrerClickTime")
            Log.d("MainApplication", "Direct referrer check - Install time: $appInstallTime")
            
            // Store the referrer in SharedPreferences
            val prefs = getSharedPreferences("ReferrerPrefs", Context.MODE_PRIVATE)
            val editor = prefs.edit()
            editor.putString("installReferrer", referrerUrl)
            editor.putLong("referrerClickTime", referrerClickTime)
            editor.putLong("installBeginTime", appInstallTime)
            editor.putLong("referrerTimestamp", System.currentTimeMillis())
            editor.apply()
            
            Log.d("MainApplication", "Stored referrer data in SharedPreferences")
          } catch (e: Exception) {
            Log.e("MainApplication", "Error getting referrer directly: ${e.message}")
          }
        } else {
          Log.e("MainApplication", "Install Referrer API connection failed with code: $responseCode")
        }
      }

      override fun onInstallReferrerServiceDisconnected() {
        Log.e("MainApplication", "Install Referrer service disconnected")
      }
    })
  }

  /**
   * Loads Flipper in React Native templates. Call this in the onCreate method with something like
   * initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
   *
   * @param context
   * @param reactInstanceManager
   */
  private fun initializeFlipper(context: Context, reactInstanceManager: ReactInstanceManager?) {
    if (BuildConfig.DEBUG) {
      try {
        /*
         We use reflection here to pick up the class that initializes Flipper,
        since Flipper library is not available in release mode
        */
        val aClass = Class.forName("com.mynarnapp.ReactNativeFlipper")
        aClass
          .getMethod("initializeFlipper", Context::class.java, ReactInstanceManager::class.java)
          .invoke(null, context, reactInstanceManager)
      } catch (e: ClassNotFoundException) {
        e.printStackTrace()
      } catch (e: NoSuchMethodException) {
        e.printStackTrace()
      } catch (e: IllegalAccessException) {
        e.printStackTrace()
      } catch (e: java.lang.reflect.InvocationTargetException) {
        e.printStackTrace()
      }
    }
  }
}
