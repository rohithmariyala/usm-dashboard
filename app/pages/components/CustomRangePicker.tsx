import React, { useState, useEffect } from 'react';
import { CalendarIcon, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isValid, parseISO } from "date-fns";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface CustomDateRangePickerProps {
  onDateRangeChange: (range: DateRange) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CustomDateRangePicker: React.FC<CustomDateRangePickerProps> = ({
  onDateRangeChange,
  open: controlledOpen,
  onOpenChange: setControlledOpen
}) => {
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined
  });

  // Handle controlled/uncontrolled state
  const isControlled = controlledOpen !== undefined && setControlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : open;
  const setIsOpen = isControlled ? setControlledOpen : setOpen;
  
  // Get formatted date range text
  const getDateRangeText = () => {
    if (dateRange.from && dateRange.to) {
      if (dateRange.from.toDateString() === dateRange.to.toDateString()) {
        return format(dateRange.from, "MMM d, yyyy");
      }
      return `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`;
    }
    
    if (dateRange.from) {
      return `${format(dateRange.from, "MMM d, yyyy")} - ?`;
    }
    
    return "Select date range";
  };
  
  // Apply the date range and close the popover
  const applyDateRange = () => {
    if (dateRange.from && dateRange.to) {
      onDateRangeChange(dateRange);
      setIsOpen(false);
    }
  };
  
  // Clear the date range
  const clearDateRange = () => {
    const newRange = {
      from: undefined,
      to: undefined
    };
    setDateRange(newRange);
    onDateRangeChange(newRange);
  };
  
  // Update the date range when the selection changes
  const handleDateRangeChange = (range: any) => {
    setDateRange({
      from: range?.from,
      to: range?.to
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="bg-slate-800 border-slate-700 text-white w-44 justify-start"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="truncate">{getDateRangeText()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 bg-slate-800 border-slate-700 text-white" 
        align="center"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={dateRange.from}
          selected={{
            from: dateRange.from,
            to: dateRange.to,
          }}
          onSelect={handleDateRangeChange}
          numberOfMonths={2}
          className="border-b border-slate-700"
        />
        <div className="flex justify-between p-3">
          <Button 
            variant="ghost" 
            onClick={clearDateRange}
            className="text-slate-400 hover:text-white hover:bg-slate-700"
          >
            Clear
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={applyDateRange} 
              disabled={!dateRange.from || !dateRange.to}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="mr-1 h-4 w-4" />
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CustomDateRangePicker;