import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/authStore';
import io from 'socket.io-client';
import { createPeerConnection, getLocalStream, stopStream, toggleAudio, toggleVideo } from '../utils/webrtc';
import { appointmentAPI } from '../services/api';
import { formatAppointmentDate } from '../utils/date';

export default function VideoCall() {
  const { appointmentId } = useParams();
  const { token, user } = useAuthStore();
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [loading, setLoading] = useState(true);
  // track remote participant status
  const [remoteAudioOn, setRemoteAudioOn] = useState(true);
  const [remoteVideoOn, setRemoteVideoOn] = useState(true);
  // remote user info
  const [remoteName, setRemoteName] = useState('Therapist');
  const [remoteRole, setRemoteRole] = useState('therapist');
  const [appointment, setAppointment] = useState(null);
  const [callEnded, setCallEnded] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const initializeCall = async () => {
      try {
        // figure out remote name/role by fetching appointment
        try {
          const resp = await appointmentAPI.getById(appointmentId);
          const appt = resp.data;
          setAppointment(appt);
          if (user?.role === 'patient') {
            setRemoteName(appt.doctorId?.userId?.fullName || 'Doctor');
            setRemoteRole('doctor');
          } else if (user?.role === 'doctor') {
            setRemoteName(appt.patientId?.userId?.fullName || 'Patient');
            setRemoteRole('patient');
          }
        } catch (err) {
          console.error('Failed to fetch appointment for video:', err);
        }

        // Get local stream
        const stream = await getLocalStream();
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection
        const peerConnection = createPeerConnection();
        peerConnectionRef.current = peerConnection;

        // Add local stream tracks to peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        // Handle remote stream
        peerConnection.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current?.emit('webrtc_ice_candidate', {
              videoSessionId: appointmentId,
              candidate: event.candidate,
            });
          }
        };

        // Connect to Socket.io with error handling
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://13.206.121.55:5000/api';
        const serverUrl = apiBase.replace(/\/api$/, '');
        socketRef.current = io(serverUrl, {
          auth: { token },
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 10,
        });

        socketRef.current.on('connect', () => {
          console.log('[v0] Socket.io connected:', socketRef.current.id);
          socketRef.current.emit('join_video', {
            videoSessionId: appointmentId,
            role: 'user',
          });
        });

        socketRef.current.on('connect_error', (error) => {
          console.error('[v0] Socket.io connection error:', error);
        });

        socketRef.current.on('disconnect', (reason) => {
          console.log('[v0] Socket.io disconnected:', reason);
        });

        // someone else has joined the room; the existing peer should only
        // create an offer if the connection is in a stable state.  this
        // prevents the "glare" case where both sides create offers at once.
        socketRef.current.on('user_joined_video', async (data) => {
          console.log('[v0] Other user joined video:', data);
          try {
            if (!peerConnection) return;
            const state = peerConnection.signalingState;
            console.log('[v0] signaling state before offer', state);
            if (state !== 'stable') {
              console.warn('[v0] skipping offer because signalingState is', state);
              return;
            }

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            console.log('[v0] Sending WebRTC offer');
            socketRef.current.emit('webrtc_offer', {
              videoSessionId: appointmentId,
              offer,
            });
          } catch (error) {
            console.error('[v0] Error creating offer:', error);
          }
        });

        socketRef.current.on('webrtc_offer', async (data) => {
          console.log('[v0] Received WebRTC offer from:', data.from);
          try {
            if (!peerConnection) return;
            const state = peerConnection.signalingState;
            console.log('[v0] signaling state before setting remote offer', state);
            if (state !== 'stable') {
              console.warn('[v0] ignoring offer because state is', state);
              return;
            }
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log('[v0] Sending WebRTC answer');
            socketRef.current.emit('webrtc_answer', {
              videoSessionId: appointmentId,
              answer,
            });
          } catch (error) {
            console.error('[v0] Error handling offer:', error);
          }
        });

        socketRef.current.on('webrtc_answer', async (data) => {
          console.log('[v0] Received WebRTC answer from:', data.from);
          try {
            if (!peerConnection) return;
            const state = peerConnection.signalingState;
            console.log('[v0] signaling state before setting remote answer', state);
            if (state === 'stable') {
              // we haven't set a local offer yet, so answer is unexpected
              console.warn('[v0] ignoring answer, signalingState stable');
              return;
            }
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log('[v0] WebRTC connection established');
          } catch (error) {
            console.error('[v0] Error handling answer:', error);
          }
        });

        socketRef.current.on('webrtc_ice_candidate', async (data) => {
          try {
            console.log('[v0] Adding ICE candidate');
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (error) {
            console.error('[v0] Error adding ICE candidate:', error);
          }
        });

        // remote user toggled audio/video
        socketRef.current.on('user_toggled_audio', (data) => {
          console.log('[v0] remote audio toggled', data);
          setRemoteAudioOn(data.enabled);
        });
        socketRef.current.on('user_toggled_video', (data) => {
          console.log('[v0] remote video toggled', data);
          setRemoteVideoOn(data.enabled);
        });

        // call ended by someone
        let endHandled = false; // guard to run once
        socketRef.current.on('video_ended', (data) => {
          console.log('[v0] received video_ended', data);
          if (endHandled) return;
          endHandled = true;
          handleEndCall();
        });

        setLoading(false);
      } catch (error) {
        console.error('Failed to initialize call:', error);
        setLoading(false);
      }
    };

    initializeCall();

    return () => {
      // cleanup peer connection and socket listeners to avoid duplicates
      if (localStreamRef.current) {
        stopStream(localStreamRef.current);
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [appointmentId, token]);

  const handleToggleAudio = () => {
    if (localStreamRef.current) {
      console.log('[v0] Toggling audio:', !isAudioOn ? 'ON' : 'OFF');
      toggleAudio(localStreamRef.current, !isAudioOn);
      setIsAudioOn(!isAudioOn);
      socketRef.current?.emit('toggle_audio', {
        videoSessionId: appointmentId,
        enabled: !isAudioOn,
      });
    }
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      console.log('[v0] Toggling video:', !isVideoOn ? 'ON' : 'OFF');
      toggleVideo(localStreamRef.current, !isVideoOn);
      setIsVideoOn(!isVideoOn);
      socketRef.current?.emit('toggle_video', {
        videoSessionId: appointmentId,
        enabled: !isVideoOn,
      });
    }
  };

  const navigate = useNavigate();

  const handleEndCall = () => {
    console.log('[v0] Ending video call');
    socketRef.current?.emit('end_video', {
      videoSessionId: appointmentId,
    });

    // stop tracks and close connection
    if (localStreamRef.current) {
      stopStream(localStreamRef.current);
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // mark ended so UI flips
    setCallEnded(true);
  };

  const handleClearSession = async () => {
    if (!window.confirm('Clear stored video session record?')) return;
    try {
      await appointmentAPI.clearVideoSession(appointmentId);
      alert('Video session cleared');
    } catch (err) {
      console.error('failed to clear video session', err);
      alert('Could not clear session');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Initializing video call...</div>
      </Layout>
    );
  }

  if (callEnded) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-semibold mb-4">Call has ended</h2>
          <button
            className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            onClick={() => navigate('/')}
          >
            Back to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* show scheduled time */}
        {appointment && (
          <p className="text-center mb-4 text-gray-700">
            Scheduled for: {formatAppointmentDate(appointment.appointmentDate)}
          </p>
        )}
        <div className="bg-black rounded-lg overflow-hidden shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-900">
            {/* Local Video */}
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-96 object-cover"
              />
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
                {user?.fullName || 'You'} ({user?.role})
              </div>
            </div>

            {/* Remote Video */}
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-96 object-cover"
                style={{ display: remoteVideoOn ? 'block' : 'none' }}
              />
              {!remoteVideoOn && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-xl">
                  Video off
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                {remoteName} ({remoteRole})
                {!remoteAudioOn && <MicOff size={16} />}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-gray-800 p-6 flex justify-center gap-6">
            <button
              onClick={handleToggleAudio}
              className={`p-4 rounded-full transition ${
                isAudioOn
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={isAudioOn ? 'Mute' : 'Unmute'}
            >
              {isAudioOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>

            <button
              onClick={handleToggleVideo}
              className={`p-4 rounded-full transition ${
                isVideoOn
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={isVideoOn ? 'Stop Camera' : 'Start Camera'}
            >
              {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>

            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition"
              title="End Call"
            >
              <Phone size={24} />
            </button>
            <button
              onClick={handleClearSession}
              className="p-4 rounded-full bg-neutral-600 hover:bg-neutral-700 text-white transition"
              title="Clear session record"
            >
              <Trash2 size={24} />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
