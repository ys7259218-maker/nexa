"use client";

import { useEffect, useState } from "react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { supabase } from "@/lib/supabase";

type GeneralSettingsProps = {
  employeeId: string;
};

export default function GeneralSettings({
  employeeId,
}: GeneralSettingsProps) {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [businessDescription, setBusinessDescription] =
    useState("");
  const [greetingMessage, setGreetingMessage] =
    useState("");
  const [timezone, setTimezone] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [status, setStatus] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      if (!employeeId) return;

      setLoading(true);
      setMessage("");

      const { data: employee, error: employeeError } =
        await supabase
          .from("ai_employees")
          .select("name, business_name")
          .eq("id", employeeId)
          .maybeSingle();

      if (employeeError) {
        console.error(
          "Employee load error:",
          employeeError
        );
      }

      const {
        data: settings,
        error: settingsError,
      } = await supabase
        .from("ai_employee_general_settings")
        .select(
          "role, department, business_description, greeting_message, timezone, working_hours, status"
        )
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (settingsError) {
        console.error(
          "General settings load error:",
          settingsError
        );
      }

      if (employee) {
        setName(employee.name || "");
        setBusinessName(employee.business_name || "");
      }

      if (settings) {
        setRole(settings.role || "");
        setDepartment(settings.department || "");
        setBusinessDescription(
          settings.business_description || ""
        );
        setGreetingMessage(
          settings.greeting_message || ""
        );
        setTimezone(settings.timezone || "");
        setWorkingHours(
          settings.working_hours || ""
        );
        setStatus(settings.status || "");
      }

      setLoading(false);
    }

    loadSettings();
  }, [employeeId]);

  async function saveChanges() {
    if (!employeeId) return;

    setSaving(true);
    setMessage("");

    try {
      const { error: employeeError } =
        await supabase
          .from("ai_employees")
          .update({
            name,
            business_name: businessName,
          })
          .eq("id", employeeId);

      if (employeeError) {
        throw employeeError;
      }

      const { error: settingsError } =
        await supabase
          .from("ai_employee_general_settings")
          .upsert(
            {
              employee_id: employeeId,
              role,
              department,
              business_description:
                businessDescription,
              greeting_message:
                greetingMessage,
              timezone,
              working_hours:
                workingHours,
              status,
              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: "employee_id",
            }
          );

      if (settingsError) {
        throw settingsError;
      }

      setMessage(
        "General settings saved successfully."
      );
    } catch (error) {
      console.error(
        "General settings save error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save general settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-zinc-400">
          Loading general settings...
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          General Settings
        </h2>

        <p className="text-zinc-400 mt-1">
          Configure your AI Employee identity.
        </p>
      </div>

      <Input
        placeholder="AI Employee Name"
        value={name}
        onChange={(e) =>
          setName(e.target.value)
        }
      />

      <Input
        placeholder="Business Name"
        value={businessName}
        onChange={(e) =>
          setBusinessName(e.target.value)
        }
      />

      <Input
        placeholder="Role"
        value={role}
        onChange={(e) =>
          setRole(e.target.value)
        }
      />

      <Input
        placeholder="Department"
        value={department}
        onChange={(e) =>
          setDepartment(e.target.value)
        }
      />

      <Input
        placeholder="Business Description"
        value={businessDescription}
        onChange={(e) =>
          setBusinessDescription(
            e.target.value
          )
        }
      />

      <Input
        placeholder="Greeting Message"
        value={greetingMessage}
        onChange={(e) =>
          setGreetingMessage(
            e.target.value
          )
        }
      />

      <Input
        placeholder="Timezone"
        value={timezone}
        onChange={(e) =>
          setTimezone(e.target.value)
        }
      />

      <Input
        placeholder="Working Hours"
        value={workingHours}
        onChange={(e) =>
          setWorkingHours(
            e.target.value
          )
        }
      />

      <Input
        placeholder="Status (Active / Offline)"
        value={status}
        onChange={(e) =>
          setStatus(e.target.value)
        }
      />

      <div className="pt-2">
        <Button
          onClick={saveChanges}
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : "Save Changes"}
        </Button>
      </div>

      {message && (
        <p className="text-sm text-zinc-400">
          {message}
        </p>
      )}
    </Card>
  );
}