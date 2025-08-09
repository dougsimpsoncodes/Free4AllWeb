import { emailService } from "./emailService";
import { smsService } from "./smsService";

class NotificationService {
  async sendPreGameNotifications(email: string, phoneNumber: string, data: any) {
    await emailService.sendPreGameAlert(email, data);
    await smsService.sendPreGameSMSAlert(phoneNumber, data);
  }

  async sendPostGameNotifications(email: string, phoneNumber: string, data: any) {
    await emailService.sendPostGameAlert(email, data);
    await smsService.sendPostGameSMSAlert(phoneNumber, data);
  }
}

export const notificationService = new NotificationService();
