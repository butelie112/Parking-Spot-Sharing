'use client';

import { useState } from 'react';
import { ParkingSpot } from '@/lib/supabase';
import { Car, X, Calendar, User as UserIcon, MapPin } from 'lucide-react';

type MapViewProps = {
  spots: ParkingSpot[];
  currentUserId: string | undefined;
  onUpdateStatus: (spotId: string, newStatus: ParkingSpot['status']) => void;
  onDeleteSpot: (spotId: string) => void;
};

export function MapView({ spots, currentUserId, onUpdateStatus, onDeleteSpot }: MapViewProps) {
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);

  const getSpotColor = (status: ParkingSpot['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-400 hover:bg-green-500 border-green-600';
      case 'reserved':
        return 'bg-amber-400 hover:bg-amber-500 border-amber-600';
      case 'occupied':
        return 'bg-red-400 hover:bg-red-500 border-red-600';
      default:
        return 'bg-gray-400 hover:bg-gray-500 border-gray-600';
    }
  };

  const getStatusIcon = (status: ParkingSpot['status']) => {
    return <Car className="w-8 h-8 text-white drop-shadow-md" />;
  };

  const isOwner = (spot: ParkingSpot) => spot.owner_id === currentUserId;

  return (
    <div className="relative">
      {/* Map Grid - Visual Parking Lot Layout */}
      <div className="bg-gradient-to-br from-gray-700 via-gray-600 to-gray-700 rounded-3xl p-8 shadow-2xl border-4 border-gray-800 min-h-[600px]">
        <div className="flex items-center gap-2 mb-6 text-white">
          <MapPin className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Parking Lot Map</h2>
        </div>

        {/* Grid Layout - Like a Real Parking Lot */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {spots.map((spot) => (
            <button
              key={spot.id}
              onClick={() => setSelectedSpot(spot)}
              className={`
                ${getSpotColor(spot.status)}
                relative
                aspect-square
                rounded-2xl
                border-4
                transition-all
                duration-300
                transform
                hover:scale-110
                hover:shadow-2xl
                hover:z-10
                cursor-pointer
                flex
                flex-col
                items-center
                justify-center
                gap-2
                p-3
                group
              `}
            >
              {/* Car Icon */}
              <div className="transform group-hover:scale-110 transition-transform">
                {getStatusIcon(spot.status)}
              </div>

              {/* Spot Name */}
              <div className="text-white font-bold text-sm text-center drop-shadow-md truncate w-full">
                {spot.name}
              </div>

              {/* Owner Badge */}
              {isOwner(spot) && (
                <div className="absolute top-1 right-1 bg-white bg-opacity-90 text-indigo-600 text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                  You
                </div>
              )}

              {/* Status Indicator */}
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-20 backdrop-blur-sm text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                {spot.status}
              </div>
            </button>
          ))}
        </div>

        {spots.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-white">
            <Car className="w-24 h-24 mb-4 opacity-50" />
            <p className="text-xl font-semibold mb-2">No parking spots yet</p>
            <p className="text-gray-300">Add spots to see them on the map</p>
          </div>
        )}
      </div>

      {/* Detailed Spot Modal */}
      {selectedSpot && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedSpot(null)}
        >
          <div
            className={`
              ${
                selectedSpot.status === 'available'
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-500'
                  : selectedSpot.status === 'reserved'
                  ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-500'
                  : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-500'
              }
              border-4
              rounded-3xl
              p-8
              max-w-lg
              w-full
              shadow-2xl
              transform
              scale-100
              animate-in
              zoom-in
              duration-300
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedSpot(null)}
              className="absolute top-4 right-4 bg-white hover:bg-gray-100 p-2 rounded-full shadow-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>

            {/* Spot Header */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className={`
                ${
                  selectedSpot.status === 'available'
                    ? 'bg-green-500'
                    : selectedSpot.status === 'reserved'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }
                p-4
                rounded-2xl
                shadow-lg
              `}
              >
                <Car className="w-12 h-12 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-bold text-gray-900 mb-1">{selectedSpot.name}</h3>
                {isOwner(selectedSpot) && (
                  <span className="inline-block bg-indigo-600 text-white text-sm font-semibold px-3 py-1 rounded-full">
                    <UserIcon className="w-4 h-4 inline mr-1" />
                    Your Spot
                  </span>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className="mb-6">
              <div
                className={`
                inline-block
                ${
                  selectedSpot.status === 'available'
                    ? 'bg-green-500'
                    : selectedSpot.status === 'reserved'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }
                text-white
                px-6
                py-2
                rounded-full
                font-bold
                text-lg
                uppercase
                tracking-wider
                shadow-lg
              `}
              >
                {selectedSpot.status}
              </div>
            </div>

            {/* Spot Details */}
            <div className="bg-white bg-opacity-50 rounded-2xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-5 h-5" />
                <span className="text-sm">
                  <strong>Created:</strong> {new Date(selectedSpot.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-5 h-5" />
                <span className="text-sm">
                  <strong>Updated:</strong> {new Date(selectedSpot.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Actions - Only for Owners */}
            {isOwner(selectedSpot) && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">Change Status:</p>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      onUpdateStatus(selectedSpot.id, 'available');
                      setSelectedSpot(null);
                    }}
                    disabled={selectedSpot.status === 'available'}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
                  >
                    Available
                  </button>
                  <button
                    onClick={() => {
                      onUpdateStatus(selectedSpot.id, 'reserved');
                      setSelectedSpot(null);
                    }}
                    disabled={selectedSpot.status === 'reserved'}
                    className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
                  >
                    Reserved
                  </button>
                  <button
                    onClick={() => {
                      onUpdateStatus(selectedSpot.id, 'occupied');
                      setSelectedSpot(null);
                    }}
                    disabled={selectedSpot.status === 'occupied'}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl"
                  >
                    Occupied
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this spot?')) {
                      onDeleteSpot(selectedSpot.id);
                      setSelectedSpot(null);
                    }
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-xl mt-2"
                >
                  Delete Spot
                </button>
              </div>
            )}

            {/* Info for Non-Owners */}
            {!isOwner(selectedSpot) && (
              <div className="bg-white bg-opacity-50 rounded-2xl p-4 text-center">
                <p className="text-gray-700 font-medium">
                  {selectedSpot.status === 'available' ? (
                    <>
                      <span className="text-2xl">✓</span>
                      <br />
                      This spot is available to park
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">⚠</span>
                      <br />
                      This spot is currently not available
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

