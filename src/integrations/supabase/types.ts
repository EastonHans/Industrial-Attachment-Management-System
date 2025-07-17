export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      verification_status: {
        Row: {
          id: string
          student_id: string
          is_verified: boolean
          verification_date: string
          verification_details: Json
          created_at: string
          updated_at: string
          fee_verified: boolean | null
          fee_verification_date: string | null
        }
        Insert: {
          id?: string
          student_id: string
          is_verified: boolean
          verification_date?: string
          verification_details?: Json
          created_at?: string
          updated_at?: string
          fee_verified?: boolean | null
          fee_verification_date?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          is_verified?: boolean
          verification_date?: string
          verification_details?: Json
          created_at?: string
          updated_at?: string
          fee_verified?: boolean | null
          fee_verification_date?: string | null
        }
      }
      supervisor_assignments: {
        Row: {
          id: string
          student_id: string
          supervisor_id: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          supervisor_id: string
          status: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          supervisor_id?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      supervisors: {
        Row: {
          id: string
          department: string
          title: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          department: string
          title: string
          status: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          department?: string
          title?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          address: string
          location: string
          industry: string
          contact_email: string
          contact_phone: string
          description: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          location: string
          industry: string
          contact_email: string
          contact_phone: string
          description: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          location?: string
          industry?: string
          contact_email?: string
          contact_phone?: string
          description?: string
          created_at?: string
          updated_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          student_id: string
          attachment_id: string
          title: string
          content: string
          report_type: string
          status: string
          submission_date: string
          feedback: string
          week_number: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          attachment_id: string
          title: string
          content: string
          report_type: string
          status: string
          submission_date?: string
          feedback?: string
          week_number?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          attachment_id?: string
          title?: string
          content?: string
          report_type?: string
          status?: string
          submission_date?: string
          feedback?: string
          week_number?: number
          created_at?: string
          updated_at?: string
        }
      }
      attachments: {
        Row: {
          id: string;
          student_id: string;
          company_id: string;
          reimbursement_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          company_id: string;
          reimbursement_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          company_id?: string;
          reimbursement_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      students: {
        Row: {
          id: string;
          student_id: string;
          program: string;
          year_of_study: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          program: string;
          year_of_study: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          program?: string;
          year_of_study?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          email: string;
          phone_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          phone_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      weekly_logs: {
        Row: {
          id: string;
          student_id: string;
          week_number: number;
          date: string;
          day: string;
          task_assigned: string;
          attachee_remarks: string;
          trainer_remarks: string | null;
          supervisor_remarks: string | null;
          trainer_signature: string | null;
          supervisor_signature: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          week_number: number;
          date: string;
          day: string;
          task_assigned: string;
          attachee_remarks: string;
          trainer_remarks?: string | null;
          supervisor_remarks?: string | null;
          trainer_signature?: string | null;
          supervisor_signature?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          week_number?: number;
          date?: string;
          day?: string;
          task_assigned?: string;
          attachee_remarks?: string;
          trainer_remarks?: string | null;
          supervisor_remarks?: string | null;
          trainer_signature?: string | null;
          supervisor_signature?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      evaluations: {
        Row: {
          id: string;
          student_id: string;
          supervisor_id: string;
          week_number: number;
          availability_of_documents: number;
          organization_of_logbook: number;
          adaptability: number;
          teamwork: number;
          accomplishment: number;
          presence: number;
          communication_skills: number;
          mannerism: number;
          understanding_of_tasks: number;
          oral_presentation: number;
          total: number;
          overall_assessment: string;
          comments: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          supervisor_id: string;
          week_number: number;
          availability_of_documents: number;
          organization_of_logbook: number;
          adaptability: number;
          teamwork: number;
          accomplishment: number;
          presence: number;
          communication_skills: number;
          mannerism: number;
          understanding_of_tasks: number;
          oral_presentation: number;
          total: number;
          overall_assessment: string;
          comments?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          supervisor_id?: string;
          week_number?: number;
          availability_of_documents?: number;
          organization_of_logbook?: number;
          adaptability?: number;
          teamwork?: number;
          accomplishment?: number;
          presence?: number;
          communication_skills?: number;
          mannerism?: number;
          understanding_of_tasks?: number;
          oral_presentation?: number;
          total?: number;
          overall_assessment?: string;
          comments?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
