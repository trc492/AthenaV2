import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FormSubmitButtonsProps {
  isEditMode: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onClear: () => void;
  onSubmit: () => void;
  submitText: string;
  updateText: string;
}

export function FormSubmitButtons({
  isEditMode,
  isSubmitting,
  onCancel,
  onClear,
  onSubmit,
  submitText,
  updateText,
}: FormSubmitButtonsProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <>
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear form?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all fields to their default values. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onClear();
                setShowClearConfirm(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="sticky bottom-0 z-20 rounded-xl border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:py-4">
        <CardContent className="">
          {isEditMode ? (
            <div className="grid grid-cols-2 items-center gap-3 md:flex md:justify-between">
              <div className="order-3 col-span-2 text-center text-xs text-muted-foreground md:order-1 md:col-span-1 md:text-left md:text-sm">
                Update the entry and return to dashboard
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-3 md:order-2 md:flex">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="h-11 hover:bg-muted"
                  size="lg"
                >
                  Cancel
                </Button>
                <Button
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="h-11 min-w-[140px] text-base"
                  size="lg"
                >
                  {isSubmitting ? (
                    "Updating..."
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      {updateText}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-3 md:flex">
              <div className="min-w-0 md:flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowClearConfirm(true)}
                  className="h-11 w-full hover:bg-muted md:w-auto"
                  size="lg"
                >
                  Clear Form
                </Button>
              </div>
              <div className="order-3 col-span-2 text-center text-xs text-muted-foreground md:order-none md:col-span-1 md:flex-1 md:text-sm">
                Saved locally first, then synced automatically
              </div>
              <div className="flex-shrink-0">
                <Button
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="h-11 w-full min-w-[140px] text-base md:w-auto"
                  size="lg"
                >
                  {isSubmitting ? (
                    "Saving..."
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      {submitText}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
