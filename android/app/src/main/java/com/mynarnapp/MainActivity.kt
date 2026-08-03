package com.mynarnapp

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  companion object {
    private const val TAG = "DeepLink"
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    Log.d(TAG, "MainActivity onCreate action=${intent?.action} data=${intent?.data}")
    WindowCompat.setDecorFitsSystemWindows(window, false)

    // Light nav bar background with dark system buttons for visibility
    window.navigationBarColor = Color.parseColor("#F0F0F0")

    WindowInsetsControllerCompat(window, window.decorView).apply {
      isAppearanceLightNavigationBars = true
    }
  }

  override fun onNewIntent(intent: Intent) {
    Log.d(TAG, "MainActivity onNewIntent action=${intent.action} data=${intent.data}")
    super.onNewIntent(intent)
    setIntent(intent)
    Log.d(TAG, "MainActivity onNewIntent setIntent done data=${getIntent()?.data}")
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "mynaRnApp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which enables you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
