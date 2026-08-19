import AppLayout from "@/components/layout/AppLayout";
import GeneralSettings from "@/components/ai/GeneralSettings";
import VoiceSettings from "@/components/ai/VoiceSettings";
import KnowledgeBase from "@/components/ai/KnowledgeBase";
import PhoneSetup from "@/components/ai/PhoneSetup";
import WhatsAppSetup from "@/components/ai/WhatsAppSetup";
import DeployAI from "@/components/ai/DeployAI";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AIEmployeeDetailsPage({
  params,
}: PageProps) {
  const { id } = await params;

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

        <GeneralSettings employeeId={id} />

       <VoiceSettings employeeId={id} />

        <KnowledgeBase employeeId={id} />

        <PhoneSetup employeeId={id} />

        <WhatsAppSetup employeeId={id} />

        <DeployAI employeeId={id} />

      </div>
    </AppLayout>
  );
}