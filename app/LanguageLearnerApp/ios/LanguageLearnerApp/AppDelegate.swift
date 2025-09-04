import UIKit
import React

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    
    guard let jsCodeLocation = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index") else {
      print("ERROR: Could not find JavaScript bundle. Make sure Metro bundler is running.")
      print("Run 'npx react-native start' in a separate terminal before launching the app.")
      return false
    }
    
    let rootView = RCTRootView(bundleURL: jsCodeLocation, moduleName: "LanguageLearnerApp", initialProperties: nil, launchOptions: launchOptions)
    
    self.window = UIWindow(frame: UIScreen.main.bounds)
    let rootViewController = UIViewController()
    rootViewController.view = rootView
    self.window?.rootViewController = rootViewController
    self.window?.makeKeyAndVisible()

    return true
  }
}
