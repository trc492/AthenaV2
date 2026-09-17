"use client";

import * as React from "react";
import { CalendarDays, ChevronsUpDown, Plus, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEventConfig } from "@/hooks/use-event-config";
import { useGameConfig } from "@/hooks/use-game-config";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { PERMISSIONS } from "@/lib/auth/roles";
import type { Event, CustomEvent } from "@/lib/types/events/events";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";

function formatDate(date: Date | undefined) {
  if (!date) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function EventSwitcher() {
  const { isMobile } = useSidebar();
  const {
    events,
    selectedEvent,
    setSelectedEvent,
    isLoading,
    error,
    setEvents,
  } = useEventConfig();
  const {
    currentYear,
    competitionType,
    config,
    setCurrentYear,
  } = useGameConfig();

  // Get years for the currently selected competition type
  const availableYears = Object.keys(config[competitionType] || {}).sort(
    (a, b) => parseInt(b) - parseInt(a),
  );

  const [addEventDialogOpen, setAddEventDialogOpen] = React.useState(false);
  const [editEventDialogOpen, setEditEventDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<CustomEvent | null>(
    null,
  );
  const [customEvents, setCustomEvents] = React.useState<CustomEvent[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [eventToDelete, setEventToDelete] = React.useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [newEventForm, setNewEventForm] = React.useState({
    eventCode: "",
    name: "",
    date: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    matchCount: 0,
    location: "",
    region: "",
  });
  const [dateOpen, setDateOpen] = React.useState(false);
  const [endDateOpen, setEndDateOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Fetch custom events to identify which events are custom
  React.useEffect(() => {
    const fetchCustomEvents = async () => {
      try {
        const response = await fetch(
          `/api/events/custom-events?year=${currentYear}`,
        );
        if (response.ok) {
          const data = await response.json();
          setCustomEvents(data);
        }
      } catch (error) {
        console.warn(
          "Failed to fetch custom events for identification:",
          error,
        );
      }
    };
    fetchCustomEvents();
  }, [currentYear]);

  // Check if an event is a custom event
  const isCustomEvent = (eventCode: string) => {
    return customEvents.some(
      (customEvent: CustomEvent) => customEvent.eventCode === eventCode,
    );
  };

  const handleAddEvent = async () => {
    if (!newEventForm.eventCode || !newEventForm.name || !newEventForm.date) {
      toast.error("Event code, name, and date are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const eventData = {
        eventCode: newEventForm.eventCode,
        competitionType: competitionType,
        name: newEventForm.name,
        date: newEventForm.date.toISOString().split("T")[0], // Convert Date to YYYY-MM-DD string
        endDate: newEventForm.endDate
          ? newEventForm.endDate.toISOString().split("T")[0]
          : null,
        matchCount: newEventForm.matchCount || 0,
        location: newEventForm.location || undefined,
        region: newEventForm.region || undefined,
        year: currentYear,
      };

      const response = await fetch("/api/events/custom-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error("Failed to add custom event");
      }

      // Add the new event to the events list
      const newEvent = {
        name: newEventForm.name,
        region: newEventForm.location
          ? `${newEventForm.location}${newEventForm.region ? ", " + newEventForm.region : ""}`
          : `Custom Event: ${currentYear}`,
        eventCode: newEventForm.eventCode,
      };

      setEvents([...events, newEvent]);
      setSelectedEvent(newEvent);

      // Reset form and close dialog
      setNewEventForm({
        eventCode: "",
        name: "",
        date: undefined,
        endDate: undefined,
        matchCount: 0,
        location: "",
        region: "",
      });
      setAddEventDialogOpen(false);
      toast.success("Custom event added successfully");
    } catch (error) {
      console.error("Error adding custom event:", error);
      toast.error("Failed to add custom event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEvent = (event: Event) => {
    const customEvent = customEvents.find(
      (ce: CustomEvent) => ce.eventCode === event.eventCode,
    );
    if (customEvent) {
      setEditingEvent(customEvent);
      setNewEventForm({
        eventCode: customEvent.eventCode,
        name: customEvent.name,
        date: customEvent.date ? new Date(customEvent.date) : undefined,
        endDate: customEvent.endDate
          ? new Date(customEvent.endDate)
          : undefined,
        matchCount: customEvent.matchCount || 0,
        location: customEvent.location || "",
        region: customEvent.region || "",
      });
      setEditEventDialogOpen(true);
    }
  };

  const handleUpdateEvent = async () => {
    if (
      !editingEvent ||
      !newEventForm.eventCode ||
      !newEventForm.name ||
      !newEventForm.date
    ) {
      toast.error("Event code, name, and date are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const eventData = {
        eventCode: newEventForm.eventCode,
        name: newEventForm.name,
        date: newEventForm.date.toISOString().split("T")[0],
        endDate: newEventForm.endDate
          ? newEventForm.endDate.toISOString().split("T")[0]
          : null,
        matchCount: newEventForm.matchCount || 0,
        location: newEventForm.location || undefined,
        region: newEventForm.region || undefined,
        year: currentYear,
      };

      const response = await fetch(
        `/api/events/custom-events?eventCode=${editingEvent.eventCode}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventData),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update custom event");
      }

      // Update the events list
      const updatedEvent = {
        name: newEventForm.name,
        region: newEventForm.location
          ? `${newEventForm.location}${newEventForm.region ? ", " + newEventForm.region : ""}`
          : `Custom Event: ${currentYear}`,
        eventCode: newEventForm.eventCode,
      };

      const updatedEvents = events.map((event) =>
        event.eventCode === editingEvent.eventCode ? updatedEvent : event,
      );
      setEvents(updatedEvents);

      // Update selected event if it was the one being edited
      if (selectedEvent?.eventCode === editingEvent.eventCode) {
        setSelectedEvent(updatedEvent);
      }

      setEditEventDialogOpen(false);
      setEditingEvent(null);
      toast.success("Custom event updated successfully");
    } catch (error) {
      console.error("Error updating custom event:", error);
      toast.error("Failed to update custom event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = (event: Event) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/events/custom-events?eventCode=${eventToDelete.eventCode}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete custom event");
      }

      // Remove from events list
      const updatedEvents = events.filter(
        (e) => e.eventCode !== eventToDelete.eventCode,
      );
      setEvents(updatedEvents);

      // If the deleted event was selected, select the first available event
      if (
        selectedEvent?.eventCode === eventToDelete.eventCode &&
        updatedEvents.length > 0
      ) {
        setSelectedEvent(updatedEvents[0]);
      }

      toast.success("Custom event deleted successfully");
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    } catch (error) {
      console.error("Error deleting custom event:", error);
      toast.error("Failed to delete custom event");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            disabled
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
              <CalendarDays className="text-black dark:text-white" size={20} />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Loading events...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (error) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            disabled
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
              <CalendarDays className="text-black dark:text-white" size={20} />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium text-red-500">
                Error loading events
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!selectedEvent) {
    return null;
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                  <CalendarDays
                    className="text-black dark:text-white"
                    size={20}
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {selectedEvent.name}
                  </span>
                  <span className="truncate text-xs">
                    {selectedEvent.region}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Season
              </DropdownMenuLabel>
              <div className="px-2 py-2">
                <Select
                  value={currentYear.toString()}
                  onValueChange={(value) => setCurrentYear(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year}>
                        <div className="flex items-center gap-2">
                          <span>{year}</span>
                          <Badge variant="outline" className="text-xs">
                            {config[competitionType][year].gameName}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Events
              </DropdownMenuLabel>
              {events.map((event) => (
                <div key={event.name} className="relative">
                  <DropdownMenuItem
                    onClick={() => setSelectedEvent(event)}
                    className={`gap-2 p-2 pr-16 ${event.name == selectedEvent.name && "bg-sidebar-accent"}`}
                  >
                    {event.name}
                  </DropdownMenuItem>
                  {isCustomEvent(event.eventCode) && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <PermissionGuard
                        permission={PERMISSIONS.CONFIGURE_EVENTS}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEvent(event);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </PermissionGuard>
                      <PermissionGuard
                        permission={PERMISSIONS.CONFIGURE_EVENTS}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(event);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </PermissionGuard>
                    </div>
                  )}
                </div>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 p-2"
                onClick={() => setAddEventDialogOpen(true)}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">
                  Add event
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={addEventDialogOpen} onOpenChange={setAddEventDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Custom Event</DialogTitle>
            <DialogDescription>
              Create a new custom event not available on the web.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="eventCode" className="text-right">
                Event Code *
              </Label>
              <Input
                id="eventCode"
                value={newEventForm.eventCode}
                onChange={(e) =>
                  setNewEventForm((prev) => ({
                    ...prev,
                    eventCode: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="2025-custom-001"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name *
              </Label>
              <Input
                id="name"
                value={newEventForm.name}
                onChange={(e) =>
                  setNewEventForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="col-span-3"
                placeholder="My Custom Event"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                Date *
              </Label>
              <div className="col-span-3">
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newEventForm.date
                        ? formatDate(newEventForm.date)
                        : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newEventForm.date}
                      onSelect={(date) => {
                        setNewEventForm((prev) => ({ ...prev, date }));
                        setDateOpen(false);
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endDate" className="text-right">
                End Date
              </Label>
              <div className="col-span-3">
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newEventForm.endDate
                        ? formatDate(newEventForm.endDate)
                        : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newEventForm.endDate}
                      onSelect={(date) => {
                        setNewEventForm((prev) => ({ ...prev, endDate: date }));
                        setEndDateOpen(false);
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="matchCount" className="text-right">
                Match Count
              </Label>
              <Input
                id="matchCount"
                type="number"
                value={newEventForm.matchCount}
                onChange={(e) =>
                  setNewEventForm((prev) => ({
                    ...prev,
                    matchCount: parseInt(e.target.value) || 0,
                  }))
                }
                className="col-span-3"
                min="0"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <Input
                id="location"
                value={newEventForm.location}
                onChange={(e) =>
                  setNewEventForm((prev) => ({
                    ...prev,
                    location: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="City, State"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="region" className="text-right">
                Region
              </Label>
              <Input
                id="region"
                value={newEventForm.region}
                onChange={(e) =>
                  setNewEventForm((prev) => ({
                    ...prev,
                    region: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="District/Region"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddEventDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddEvent}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editEventDialogOpen} onOpenChange={setEditEventDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Custom Event</DialogTitle>
            <DialogDescription>
              Update the details of this custom event.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-eventCode" className="text-right">
                Event Code *
              </Label>
              <Input
                id="edit-eventCode"
                value={newEventForm.eventCode}
                onChange={(e) =>
                  setNewEventForm((prev) => ({
                    ...prev,
                    eventCode: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="2025-custom-001"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name *
              </Label>
              <Input
                id="edit-name"
                value={newEventForm.name}
                onChange={(e) =>
                  setNewEventForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="col-span-3"
                placeholder="My Custom Event"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-date" className="text-right">
                Date *
              </Label>
              <div className="col-span-3">
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newEventForm.date
                        ? formatDate(newEventForm.date)
                        : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newEventForm.date}
                      onSelect={(date) => {
                        setNewEventForm((prev) => ({ ...prev, date }));
                        setDateOpen(false);
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-endDate" className="text-right">
                End Date
              </Label>
              <div className="col-span-3">
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newEventForm.endDate
                        ? formatDate(newEventForm.endDate)
                        : "Select end date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newEventForm.endDate}
                      onSelect={(date) => {
                        setNewEventForm((prev) => ({ ...prev, endDate: date }));
                        setEndDateOpen(false);
                      }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-matchCount" className="text-right">
                Match Count
              </Label>
              <Input
                id="edit-matchCount"
                type="number"
                value={newEventForm.matchCount}
                onChange={(e) =>
                  setNewEventForm((prev) => ({
                    ...prev,
                    matchCount: parseInt(e.target.value) || 0,
                  }))
                }
                className="col-span-3"
                min="0"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-location" className="text-right">
                Location
              </Label>
              <Input
                id="edit-location"
                value={newEventForm.location}
                onChange={(e) =>
                  setNewEventForm((prev) => ({
                    ...prev,
                    location: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="City, State"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-region" className="text-right">
                Region
              </Label>
              <Input
                id="edit-region"
                value={newEventForm.region}
                onChange={(e) =>
                  setNewEventForm((prev) => ({
                    ...prev,
                    region: e.target.value,
                  }))
                }
                className="col-span-3"
                placeholder="District/Region"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditEventDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdateEvent}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDeleteEvent}
        title="Delete Custom Event"
        description={`Are you sure you want to delete "${eventToDelete?.name}"? This action cannot be undone and will permanently remove the event and all associated data.`}
        loading={isDeleting}
      />
    </>
  );
}
