// Minimal iOS Test App for Free4AllWeb APNs Testing
// Create new iOS project in Xcode with Bundle ID: com.free4all.dealapp

import UIKit
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Request notification permissions
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                print("✅ Notification permission granted")
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            } else {
                print("❌ Notification permission denied: \(error?.localizedDescription ?? "Unknown")")
            }
        }
        
        return true
    }
    
    // APNS token received
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("📱 Device Token: \(tokenString)")
        
        // Send to Free4AllWeb backend
        registerWithBackend(deviceToken: tokenString)
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("❌ Failed to register for remote notifications: \(error.localizedDescription)")
    }
    
    // Handle received notifications
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        print("🔔 Notification received: \(userInfo)")
        
        // Handle notification actions
        switch response.actionIdentifier {
        case "VIEW_DEALS":
            print("User tapped 'View Deals'")
        case "GET_DIRECTIONS":
            print("User tapped 'Get Directions'")
        default:
            break
        }
        
        completionHandler()
    }
    
    // Show notification when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.alert, .sound, .badge])
    }
    
    private func registerWithBackend(deviceToken: String) {
        // Replace with your local server URL
        guard let url = URL(string: "http://localhost:5001/api/device-token/register") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        // Add your auth token here when you have one
        
        let body = [
            "deviceToken": deviceToken,
            "platform": "ios",
            "deviceInfo": [
                "model": UIDevice.current.model,
                "osVersion": UIDevice.current.systemVersion,
                "appVersion": "1.0.0"
            ]
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    print("❌ Registration failed: \(error.localizedDescription)")
                    return
                }
                
                if let httpResponse = response as? HTTPURLResponse {
                    print("📡 Registration response: \(httpResponse.statusCode)")
                    if let data = data, let responseString = String(data: data, encoding: .utf8) {
                        print("Response: \(responseString)")
                    }
                }
            }.resume()
            
        } catch {
            print("❌ Failed to serialize registration request: \(error)")
        }
    }
}

// ViewController for testing
class ViewController: UIViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        view.backgroundColor = .systemBackground
        
        let label = UILabel()
        label.text = "Free4AllWeb APNs Test"
        label.textAlignment = .center
        label.font = UIFont.systemFont(ofSize: 24, weight: .bold)
        label.translatesAutoresizingMaskIntoConstraints = false
        
        let testButton = UIButton(type: .system)
        testButton.setTitle("Test Notification", for: .normal)
        testButton.titleLabel?.font = UIFont.systemFont(ofSize: 18)
        testButton.addTarget(self, action: #selector(testNotification), for: .touchUpInside)
        testButton.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(label)
        view.addSubview(testButton)
        
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -50),
            
            testButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            testButton.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 30)
        ])
    }
    
    @objc private func testNotification() {
        // Call your test endpoint
        guard let url = URL(string: "http://localhost:5001/api/notifications/test") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        // Add auth headers when you have them
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if error != nil {
                    print("❌ Test notification failed")
                } else {
                    print("✅ Test notification sent")
                }
            }
        }.resume()
    }
}