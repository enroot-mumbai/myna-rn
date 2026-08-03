package com.mynarnapp;

import androidx.appcompat.app.AppCompatActivity;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.util.Log;

public class SplashActivity extends AppCompatActivity {

    private static final String TAG = "DeepLink";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        Intent incoming = getIntent();
        Uri data = incoming != null ? incoming.getData() : null;
        String action = incoming != null ? incoming.getAction() : null;
        Log.d(TAG, "Splash onCreate action=" + action + " data=" + data
                + " extras=" + (incoming != null ? incoming.getExtras() : null));

        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                Intent i = new Intent(SplashActivity.this, MainActivity.class);
                i.setData(getIntent().getData());
                i.setAction(getIntent().getAction());
                if (getIntent().getExtras() != null) {
                    i.putExtras(getIntent());
                }
                Log.d(TAG, "Splash → MainActivity action=" + i.getAction()
                        + " data=" + i.getData());
                startActivity(i);
                finish();
            }
        }, 1500);
    }
}
