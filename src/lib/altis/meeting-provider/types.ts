export interface MeetingCreationResult {
  provider: "GOOGLE_MEET";
  joinUrl: string;
  code: string;
  externalMeetingId: string;
}

export interface MeetingSessionInput {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface RawAttendanceEvent {
  email: string;
  displayName?: string;
  joinedAt: string;
  leftAt: string | null;
}

export interface MeetingProvider {
  createMeeting(session: MeetingSessionInput): Promise<MeetingCreationResult>;
  getMeetingInfo?(meetingId: string): Promise<{ joinUrl: string; code: string }>;
  getMeetingAttendance?(meetingCodeOrId: string, sessionDate: string): Promise<RawAttendanceEvent[]>;
}

