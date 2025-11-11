'use client';

import { useParams } from 'next/navigation';
import { RoomEntry } from '@/lib/components/RoomEntry';

export default function GuestRoomAccess() {
  const params = useParams();
  const roomLink = params.roomLink as string;
  
  return <RoomEntry roomLink={roomLink} accessType="guest" />;
}
