import React, { useState, useEffect } from 'react';
import { Calendar, Clock, X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';

interface TimeSlot {
  id?: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface DaySchedule {
  day_of_week: number;
  slots: TimeSlot[];
}

interface BlockedDate {
  id?: string;
  blocked_date: string;
  reason?: string;
}

interface SpotAvailabilityScheduleProps {
  spotId?: string;
  onSave?: (hasSchedule: boolean) => void;
  isNewSpot?: boolean;
}

// Will be initialized inside component to use translations

export function SpotAvailabilitySchedule({ 
  spotId, 
  onSave,
  isNewSpot = false 
}: SpotAvailabilityScheduleProps) {
  const { t } = useLanguage();
  
  const DAYS_OF_WEEK = [
    { value: 0, label: t.modals.addSpot.sunday, short: 'Sun' },
    { value: 1, label: t.modals.addSpot.monday, short: 'Mon' },
    { value: 2, label: t.modals.addSpot.tuesday, short: 'Tue' },
    { value: 3, label: t.modals.addSpot.wednesday, short: 'Wed' },
    { value: 4, label: t.modals.addSpot.thursday, short: 'Thu' },
    { value: 5, label: t.modals.addSpot.friday, short: 'Fri' },
    { value: 6, label: t.modals.addSpot.saturday, short: 'Sat' },
  ];
  
  const [hasSchedule, setHasSchedule] = useState(false);
  const [defaultAvailable, setDefaultAvailable] = useState(true);
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1); // Monday by default
  const [newSlot, setNewSlot] = useState<TimeSlot>({
    start_time: '09:00',
    end_time: '17:00',
    is_available: true
  });
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [blockReason, setBlockReason] = useState('');

  // Load existing schedule if editing
  useEffect(() => {
    if (spotId && !isNewSpot) {
      loadSchedule();
    }
  }, [spotId, isNewSpot]);

  const loadSchedule = async () => {
    if (!spotId) return;
    setLoading(true);

    try {
      // Load spot settings
      const { data: spot, error: spotError } = await supabase
        .from('spots')
        .select('has_availability_schedule, default_available')
        .eq('id', spotId)
        .single();

      if (spotError) throw spotError;

      if (spot) {
        setHasSchedule(spot.has_availability_schedule || false);
        setDefaultAvailable(spot.default_available !== false);
      }

      // Load availability schedules
      const { data: availSchedules, error: schedError } = await supabase
        .from('availability_schedules')
        .select('*')
        .eq('spot_id', spotId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (schedError) throw schedError;

      // Group schedules by day
      const groupedSchedules: DaySchedule[] = [];
      if (availSchedules) {
        availSchedules.forEach(schedule => {
          let daySchedule = groupedSchedules.find(ds => ds.day_of_week === schedule.day_of_week);
          if (!daySchedule) {
            daySchedule = { day_of_week: schedule.day_of_week, slots: [] };
            groupedSchedules.push(daySchedule);
          }
          daySchedule.slots.push({
            id: schedule.id,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            is_available: schedule.is_available
          });
        });
      }
      setSchedules(groupedSchedules);

      // Load blocked dates
      const { data: blocked, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('spot_id', spotId)
        .order('blocked_date', { ascending: true });

      if (blockedError) throw blockedError;
      setBlockedDates(blocked || []);

    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTimeSlot = () => {
    const daySchedule = schedules.find(s => s.day_of_week === selectedDay);
    const newSlotData = { ...newSlot };

    if (daySchedule) {
      // Check for overlaps
      const hasOverlap = daySchedule.slots.some(slot => {
        return !(newSlot.end_time <= slot.start_time || newSlot.start_time >= slot.end_time);
      });

      if (hasOverlap) {
        alert(t.modals.addSpot.timeSlotOverlaps);
        return;
      }

      daySchedule.slots.push(newSlotData);
      daySchedule.slots.sort((a, b) => a.start_time.localeCompare(b.start_time));
      setSchedules([...schedules]);
    } else {
      setSchedules([...schedules, {
        day_of_week: selectedDay,
        slots: [newSlotData]
      }]);
    }
  };

  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    const updatedSchedules = [...schedules];
    updatedSchedules[dayIndex].slots.splice(slotIndex, 1);
    
    // Remove day if no slots left
    if (updatedSchedules[dayIndex].slots.length === 0) {
      updatedSchedules.splice(dayIndex, 1);
    }
    
    setSchedules(updatedSchedules);
  };

  const addBlockedDate = () => {
    if (!newBlockedDate) return;

    // Check if date already blocked
    if (blockedDates.some(bd => bd.blocked_date === newBlockedDate)) {
      alert(t.modals.addSpot.dateAlreadyBlocked);
      return;
    }

    setBlockedDates([...blockedDates, {
      blocked_date: newBlockedDate,
      reason: blockReason || undefined
    }]);
    
    setNewBlockedDate('');
    setBlockReason('');
  };

  const removeBlockedDate = (index: number) => {
    const updated = [...blockedDates];
    updated.splice(index, 1);
    setBlockedDates(updated);
  };

  const copyToAllWeekdays = () => {
    const mondaySchedule = schedules.find(s => s.day_of_week === 1);
    if (!mondaySchedule || mondaySchedule.slots.length === 0) {
      alert(t.modals.addSpot.setMondayScheduleFirst);
      return;
    }

    const newSchedules: DaySchedule[] = [];
    // Copy Monday schedule to Tuesday-Friday (days 2-5)
    for (let day = 1; day <= 5; day++) {
      newSchedules.push({
        day_of_week: day,
        slots: mondaySchedule.slots.map(slot => ({ ...slot, id: undefined }))
      });
    }
    
    // Preserve weekend schedules if they exist
    const weekendSchedules = schedules.filter(s => s.day_of_week === 0 || s.day_of_week === 6);
    setSchedules([...newSchedules, ...weekendSchedules].sort((a, b) => a.day_of_week - b.day_of_week));
  };

  const saveSchedule = async () => {
    if (!spotId && !isNewSpot) {
      console.error('No spot ID provided');
      return;
    }

    setSaving(true);
    try {
      // If this is a new spot, we'll save the schedule data for later
      if (isNewSpot) {
        if (onSave) {
          onSave(hasSchedule);
        }
        // Store schedule data in parent component or context
        // The parent will handle saving when the spot is created
        return { hasSchedule, defaultAvailable, schedules, blockedDates };
      }

      // Update spot settings
      const { error: spotError } = await supabase
        .from('spots')
        .update({
          has_availability_schedule: hasSchedule,
          default_available: defaultAvailable,
          updated_at: new Date().toISOString()
        })
        .eq('id', spotId);

      if (spotError) throw spotError;

      // Clear existing schedules
      const { error: deleteSchedError } = await supabase
        .from('availability_schedules')
        .delete()
        .eq('spot_id', spotId);

      if (deleteSchedError) throw deleteSchedError;

      // Insert new schedules
      if (hasSchedule && schedules.length > 0) {
        const schedulesToInsert = schedules.flatMap(daySchedule =>
          daySchedule.slots.map(slot => ({
            spot_id: spotId,
            day_of_week: daySchedule.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_available: slot.is_available
          }))
        );

        const { error: insertSchedError } = await supabase
          .from('availability_schedules')
          .insert(schedulesToInsert);

        if (insertSchedError) throw insertSchedError;
      }

      // Clear existing blocked dates
      const { error: deleteBlockedError } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('spot_id', spotId);

      if (deleteBlockedError) throw deleteBlockedError;

      // Insert new blocked dates
      if (blockedDates.length > 0) {
        const blockedToInsert = blockedDates.map(blocked => ({
          spot_id: spotId,
          blocked_date: blocked.blocked_date,
          reason: blocked.reason
        }));

        const { error: insertBlockedError } = await supabase
          .from('blocked_dates')
          .insert(blockedToInsert);

        if (insertBlockedError) throw insertBlockedError;
      }

      if (onSave) {
        onSave(hasSchedule);
      }

      alert(t.modals.addSpot.schedSavedSuccess);
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert(t.modals.addSpot.schedSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  // Get schedule data for parent component (used when creating new spot)
  const getScheduleData = () => {
    return {
      has_availability_schedule: hasSchedule,
      default_available: defaultAvailable,
      schedules: schedules.flatMap(daySchedule =>
        daySchedule.slots.map(slot => ({
          day_of_week: daySchedule.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_available: slot.is_available
        }))
      ),
      blocked_dates: blockedDates.map(blocked => ({
        blocked_date: blocked.blocked_date,
        reason: blocked.reason
      }))
    };
  };

  // Expose getScheduleData to parent
  useEffect(() => {
    if (isNewSpot && window) {
      (window as any).getSpotScheduleData = getScheduleData;
    }
    return () => {
      if (isNewSpot && window) {
        delete (window as any).getSpotScheduleData;
      }
    };
  }, [hasSchedule, defaultAvailable, schedules, blockedDates, isNewSpot]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable Schedule */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="has-schedule"
            checked={hasSchedule}
            onChange={(e) => setHasSchedule(e.target.checked)}
            className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <div className="flex-1">
            <label htmlFor="has-schedule" className="font-semibold text-gray-900 cursor-pointer">
              {t.modals.addSpot.setAvailabilitySchedule}
            </label>
            <p className="text-sm text-gray-500 mt-1">
              {t.modals.addSpot.defineAvailabilityDesc}
            </p>
          </div>
        </div>

        {!hasSchedule && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={defaultAvailable}
                onChange={(e) => setDefaultAvailable(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                {defaultAvailable ? t.modals.addSpot.spotAvailableByDefault : t.modals.addSpot.spotUnavailableByDefault}
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Schedule Configuration */}
      {hasSchedule && (
        <>
          {/* Weekly Schedule */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t.modals.addSpot.weeklySchedule}
            </h3>

            {/* Add Time Slot */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex flex-wrap gap-2 mb-3">
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  {DAYS_OF_WEEK.map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))}
                </select>
                <input
                  type="time"
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
                <span className="py-2 text-gray-700">{t.modals.addSpot.to}</span>
                <input
                  type="time"
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                />
                <button
                  onClick={addTimeSlot}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  {t.modals.addSpot.add}
                </button>
              </div>
              <button
                onClick={copyToAllWeekdays}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                {t.modals.addSpot.copyMondayToWeekdays}
              </button>
            </div>

            {/* Display Schedule */}
            <div className="space-y-3">
              {DAYS_OF_WEEK.map(day => {
                const daySchedule = schedules.find(s => s.day_of_week === day.value);
                const dayIndex = schedules.findIndex(s => s.day_of_week === day.value);
                
                return (
                  <div key={day.value} className="border-b border-gray-100 pb-3 last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="w-24 font-medium text-gray-700">{day.label}</div>
                      <div className="flex-1">
                        {daySchedule && daySchedule.slots.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {daySchedule.slots.map((slot, slotIndex) => (
                              <div
                                key={slotIndex}
                                className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-lg text-sm"
                              >
                                <Clock className="w-3 h-3" />
                                {slot.start_time} - {slot.end_time}
                                <button
                                  onClick={() => removeTimeSlot(dayIndex, slotIndex)}
                                  className="ml-1 text-red-500 hover:text-red-700"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">{t.modals.addSpot.notAvailable}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blocked Dates */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {t.modals.addSpot.blockedDates}
            </h3>

            {/* Add Blocked Date */}
            <div className="mb-4 p-3 bg-red-50 rounded-lg">
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-gray-900 bg-white"
                />
                <input
                  type="text"
                  placeholder={t.modals.addSpot.reasonOptional}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-gray-900 bg-white placeholder:text-gray-400"
                />
                <button
                  onClick={addBlockedDate}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  {t.modals.addSpot.blockDate}
                </button>
              </div>
            </div>

            {/* Display Blocked Dates */}
            {blockedDates.length > 0 ? (
              <div className="space-y-2">
                {blockedDates.map((blocked, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-red-50 rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-red-800">
                        {new Date(blocked.blocked_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                      {blocked.reason && (
                        <span className="ml-2 text-sm text-gray-600">
                          - {blocked.reason}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeBlockedDate(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">{t.modals.addSpot.noBlockedDates}</p>
            )}
          </div>
        </>
      )}

      {/* Save Button */}
      {!isNewSpot && (
        <button
          onClick={saveSchedule}
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? t.modals.addSpot.saving : t.modals.addSpot.saveAvailabilitySchedule}
        </button>
      )}
    </div>
  );
}
