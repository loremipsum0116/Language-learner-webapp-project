# ProGuard/R8 최적화 설정
# Language Learner App - Android Bundle Optimization

# ===============================
# React Native 기본 설정
# ===============================

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# React Native JSC
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }

# React Native Turbo Modules
-keep class com.facebook.react.turbomodule.** { *; }

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ===============================
# JavaScript Interface
# ===============================

# WebView JavaScript Interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ===============================
# Third Party Libraries
# ===============================

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.bridge.ReadableNativeMap { *; }

# Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }

# Vector Icons
-keep class com.oblador.vectoricons.** { *; }
-keep class **.R$drawable { *; }

# Fast Image
-keep public class com.dylanvann.fastimage.** {*;}

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Expo
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }

# React Navigation
-keep class com.reactnavigation.** { *; }
-keep class com.swmansion.** { *; }

# FlashList
-keep class com.shopify.reactnative.flash_list.** { *; }

# OkHttp
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
-dontwarn org.conscrypt.**
-dontwarn okhttp3.**
-dontwarn okio.**

# ===============================
# Performance Optimizations
# ===============================

# 공격적 최적화 활성화
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
-optimizationpasses 5
-allowaccessmodification
-dontpreverify

# ===============================
# 디버깅 정보 유지
# ===============================

# 라인 넘버 유지 (크래시 리포트용)
-keepattributes SourceFile,LineNumberTable

# 어노테이션 유지
-keepattributes *Annotation*

# 시그니처 유지 (제네릭 타입)
-keepattributes Signature

# 예외 정보 유지
-keepattributes Exceptions

# ===============================
# Android 시스템 클래스
# ===============================

# Parcelable
-keepclassmembers class * implements android.os.Parcelable {
  public static final android.os.Parcelable$Creator CREATOR;
}

# Serializable
-keepnames class * implements java.io.Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    !private <fields>;
    !private <methods>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ===============================
# 릴리스 빌드 최적화
# ===============================

# 로깅 제거 (릴리스 빌드)
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}

# System.out.println 제거
-assumenosideeffects class java.lang.System {
    public static void out.println(...);
    public static void err.println(...);
}

# ===============================
# 경고 억제
# ===============================

# React Native 관련 경고 억제
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-dontwarn com.facebook.jni.**

# Third-party 라이브러리 경고 억제
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**

# JSR 305 annotations
-dontwarn javax.annotation.Nullable
-dontwarn javax.annotation.Nonnull
-dontwarn javax.annotation.CheckReturnValue
