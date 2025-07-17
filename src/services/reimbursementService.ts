import { supabase } from "@/integrations/supabase/client";
import { calculateDistance, getCoordinates } from "@/utils/locationUtils";

const CUEA_COORDINATES = {
  lat: Number(import.meta.env.VITE_CUEA_LAT) || -1.2921,
  lng: Number(import.meta.env.VITE_CUEA_LNG) || 36.8219
};

const DEFAULT_RATE = Number(import.meta.env.VITE_REIMBURSEMENT_RATE) || 20;
const DEFAULT_LUNCH = Number(import.meta.env.VITE_REIMBURSEMENT_LUNCH) || 200;

export interface ReimbursementCalculation {
  distance: number;
  amount: number;
  rate: number;
  lunch: number;
}

export interface Reimbursement {
  id: string;
  supervisor_id: string;
  student_id: string;
  company_id: string;
  amount: number;
  distance: number;
  rate: number;
  lunch: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export class ReimbursementService {
  static async calculateReimbursement(
    companyAddress: string,
    rate: number = DEFAULT_RATE,
    lunch: number = DEFAULT_LUNCH
  ): Promise<ReimbursementCalculation> {
    try {
      const companyCoords = await getCoordinates(companyAddress);
      if (!companyCoords) {
        throw new Error("Could not geocode company address");
      }

      const distance = calculateDistance(
        CUEA_COORDINATES.lat,
        CUEA_COORDINATES.lng,
        companyCoords.lat,
        companyCoords.lng
      ) * 2; // to and from

      const amount = (rate * distance) + lunch;

      return {
        distance,
        amount,
        rate,
        lunch
      };
    } catch (error) {
      console.error("Error calculating reimbursement:", error);
      throw error;
    }
  }

  static async createReimbursements(
    studentId: string,
    companyId: string,
    supervisorIds: string[],
    calculation: ReimbursementCalculation
  ): Promise<void> {
    try {
      const reimbursements = supervisorIds.map(supervisorId => ({
        supervisor_id: supervisorId,
        student_id: studentId,
        company_id: companyId,
        amount: calculation.amount,
        distance: calculation.distance,
        rate: calculation.rate,
        lunch: calculation.lunch,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from("reimbursements")
        .insert(reimbursements);

      if (error) throw error;
    } catch (error) {
      console.error("Error creating reimbursements:", error);
      throw error;
    }
  }

  static async getReimbursements(filters?: {
    status?: string;
    supervisorId?: string;
    studentId?: string;
    companyId?: string;
  }): Promise<Reimbursement[]> {
    try {
      let query = supabase
        .from("reimbursements")
        .select(`
          *,
          supervisor:supervisors (
            profile:profiles (
              first_name,
              last_name,
              email
            ),
            department,
            title
          ),
          student:students (
            profile:profiles (
              first_name,
              last_name
            )
          ),
          company:companies (
            name,
            location
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.supervisorId) {
        query = query.eq('supervisor_id', filters.supervisorId);
      }
      if (filters?.studentId) {
        query = query.eq('student_id', filters.studentId);
      }
      if (filters?.companyId) {
        query = query.eq('company_id', filters.companyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error("Error fetching reimbursements:", error);
      throw error;
    }
  }

  static async updateReimbursementStatus(
    id: string,
    status: 'approved' | 'rejected'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("reimbursements")
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating reimbursement status:", error);
      throw error;
    }
  }
}
