import AppLayout from "@/components/layout/AppLayout";
import GeneralSettings from "@/components/ai/GeneralSettings";
import VoiceSettings from "@/components/ai/VoiceSettings";
import KnowledgeBase from "@/components/ai/KnowledgeBase";
import PhoneSetup from "@/components/ai/PhoneSetup";
import WhatsAppSetup from "@/components/ai/WhatsAppSetup";
import DeployAI from "@/components/ai/DeployAI";

export default function AIEmployeeDetailsPage() {
  return (
    <AppLayout>
      <div className="space-y-8">

        <div>
          <h1 className="text-4xl font-bold">
            Nexa Receptionist
          </h1>

          <p className="text-zinc-400 mt-2">
            Manage every aspect of your AI Employee.
          </p>
        </div>

        <GeneralSettings />

        <VoiceSettings />

        <KnowledgeBase />

        <PhoneSetup />

        <WhatsAppSetup />

        <DeployAI />

      </div>
    </AppLayout>
  );
}