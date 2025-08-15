import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  itemName?: string;
  isLoading?: boolean;
  assignedStudentsCount?: number;
  deleteType?: 'student' | 'supervisor';
}

export const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  isLoading = false,
  assignedStudentsCount = 0,
  deleteType
}: DeleteConfirmationModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-1">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        {itemName && (
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm font-medium text-gray-900">{itemName}</p>
          </div>
        )}
        
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
          <p className="text-sm text-amber-800">
            <strong>Warning:</strong> This action cannot be undone. All associated data will be permanently removed.
          </p>
          {deleteType === 'supervisor' && (
            <div className="mt-2">
              <p className="text-sm text-amber-800 font-medium">
                Deleting this supervisor will also remove:
              </p>
              <ul className="list-disc list-inside text-sm text-amber-700 mt-1 space-y-1">
                {assignedStudentsCount > 0 && (
                  <li>{assignedStudentsCount} supervisor assignment{assignedStudentsCount > 1 ? 's' : ''}</li>
                )}
                <li>All evaluations made by this supervisor</li>
                <li>All reimbursement records linked to this supervisor</li>
                <li>All attachment records where this supervisor is assigned</li>
                <li>The supervisor's user account and profile</li>
              </ul>
              {assignedStudentsCount > 0 && (
                <p className="text-sm text-red-700 font-medium mt-2">
                  ⚠️ {assignedStudentsCount} student{assignedStudentsCount > 1 ? 's are' : ' is'} currently assigned to this supervisor!
                </p>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};