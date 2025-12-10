import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { supabase } from '../lib/supabase';
import {
    getCommunityTournaments,
    getTournamentBracket,
    getTournamentParticipants,
    startTournament,
    createTournamentMatchRoom,
    getUserCommunity,
} from '../services/database';

interface TournamentViewScreenProps {
    userId: string;
    tournamentId: string;
    onBack: () => void;
    onMatchRoomCreated: (roomId: string, roomCode: string) => void;
}

interface Match {
    id: string;
    round_number: number;
    match_number: number;
    status: string;
    player1: any;
    player2: any;
    winner_id: string | null;
    room_id: string | null;
}

interface Participant {
    id: string;
    seed: number;
    is_eliminated: boolean;
    placement: number | null;
    user: any;
}

export default function TournamentViewScreen({
    userId,
    tournamentId,
    onBack,
    onMatchRoomCreated,
}: TournamentViewScreenProps) {
    const [tournament, setTournament] = useState<any>(null);
    const [matches, setMatches] = useState<Match[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [userRole, setUserRole] = useState<string>('member');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchData();

        // Set up real-time subscriptions for live updates
        const tournamentChannel = supabase
            .channel(`tournament-${tournamentId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tournaments',
                    filter: `id=eq.${tournamentId}`
                },
                (payload) => {
                    console.log('Tournament updated:', payload);
                    fetchData();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tournament_matches',
                    filter: `tournament_id=eq.${tournamentId}`
                },
                (payload) => {
                    console.log('Match updated:', payload);
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(tournamentChannel);
        };
    }, [tournamentId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Get user's community role
            const { data: membership } = await getUserCommunity(userId);
            if (membership) {
                setUserRole(membership.role);
            }

            // Get tournament details
            const { data: tournamentsData } = await getCommunityTournaments(membership?.community.id || '', userId);
            const foundTournament = tournamentsData?.find((t: any) => t.id === tournamentId);
            setTournament(foundTournament);

            // Get bracket matches
            const { data: matchesData } = await getTournamentBracket(tournamentId);
            // Format matches to handle array joins
            const formattedMatches = (matchesData || []).map((m: any) => ({
                ...m,
                player1: Array.isArray(m.player1) ? m.player1[0] : m.player1,
                player2: Array.isArray(m.player2) ? m.player2[0] : m.player2,
            }));
            setMatches(formattedMatches);

            // Get participants
            const { data: participantsData } = await getTournamentParticipants(tournamentId);
            const formattedParticipants = (participantsData || []).map((p: any) => ({
                ...p,
                user: Array.isArray(p.user) ? p.user[0] : p.user,
            }));
            setParticipants(formattedParticipants);
        } catch (error) {
            console.error('Error fetching tournament:', error);
            Alert.alert('Error', 'Failed to load tournament');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const handleStartTournament = async () => {
        Alert.alert(
            'Start Tournament',
            `Start "${tournament.name}" with ${tournament.current_participants} participants? This will generate the bracket.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Start',
                    onPress: async () => {
                        setProcessing(true);
                        try {
                            const { error } = await startTournament(userId, tournamentId);
                            if (error) throw error;

                            Alert.alert('Tournament Started!', 'The bracket has been generated. Players can now start their matches.');
                            await fetchData();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to start tournament');
                        } finally {
                            setProcessing(false);
                        }
                    }
                }
            ]
        );
    };

    const handleStartMatch = async (matchId: string, opponentName: string) => {
        Alert.alert(
            'Start Match',
            `Create room to play against ${opponentName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Start',
                    onPress: async () => {
                        setProcessing(true);
                        try {
                            const { data: room, error } = await createTournamentMatchRoom(userId, tournamentId, matchId);
                            if (error) throw error;

                            onMatchRoomCreated(room.id, room.room_code);
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to create match room');
                        } finally {
                            setProcessing(false);
                        }
                    }
                }
            ]
        );
    };

    const renderMatch = (match: Match) => {
        const isUserInMatch = match.player1?.id === userId || match.player2?.id === userId;
        const canStartMatch = isUserInMatch && match.status === 'pending' && !match.room_id;
        const opponent = match.player1?.id === userId ? match.player2 : match.player1;

        return (
            <View key={match.id} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                    <Text style={styles.matchNumber}>Match {match.match_number}</Text>
                    <View style={[
                        styles.matchStatusBadge,
                        match.status === 'completed' && styles.completedBadge,
                        match.status === 'in_progress' && styles.inProgressBadge,
                    ]}>
                        <Text style={styles.matchStatusText}>
                            {match.status === 'completed' ? '✓' :
                             match.status === 'in_progress' ? '⚔️' : '⏳'}
                        </Text>
                    </View>
                </View>

                <View style={styles.playersContainer}>
                    {match.player1 && (
                        <View style={[
                            styles.playerRow,
                            match.winner_id === match.player1.id && styles.winnerRow
                        ]}>
                            <Text style={styles.playerAvatar}>{match.player1.avatar}</Text>
                            <Text style={styles.playerName}>{match.player1.username}</Text>
                            {match.winner_id === match.player1.id && (
                                <Text style={styles.winnerIcon}>🏆</Text>
                            )}
                        </View>
                    )}

                    <View style={styles.vsContainer}>
                        <Text style={styles.vsText}>VS</Text>
                    </View>

                    {match.player2 && (
                        <View style={[
                            styles.playerRow,
                            match.winner_id === match.player2.id && styles.winnerRow
                        ]}>
                            <Text style={styles.playerAvatar}>{match.player2.avatar}</Text>
                            <Text style={styles.playerName}>{match.player2.username}</Text>
                            {match.winner_id === match.player2.id && (
                                <Text style={styles.winnerIcon}>🏆</Text>
                            )}
                        </View>
                    )}
                </View>

                {canStartMatch && (
                    <TouchableOpacity
                        style={styles.startMatchButton}
                        onPress={() => handleStartMatch(match.id, opponent?.username)}
                        disabled={processing}
                    >
                        <Text style={styles.startMatchButtonText}>Start Match</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!tournament) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Tournament</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.centerContainer}>
                    <Text style={styles.errorText}>Tournament not found</Text>
                </View>
            </View>
        );
    }

    const roundNumbers = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b);
    const canStart = (userRole === 'leader' || userRole === 'co_leader') &&
                     tournament.status === 'registration' &&
                     tournament.current_participants >= tournament.min_participants;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Tournament</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Tournament Info */}
                <View style={styles.infoCard}>
                    <Text style={styles.tournamentName}>{tournament.name}</Text>
                    <Text style={styles.tournamentMeta}>
                        {tournament.format === 'single_elimination' ? '🏆 Single Elimination' : tournament.format}
                    </Text>
                    <Text style={styles.tournamentParticipants}>
                        {tournament.current_participants} / {tournament.max_participants} participants
                    </Text>
                    <View style={[
                        styles.statusBadge,
                        tournament.status === 'completed' && styles.completedBadge,
                        tournament.status === 'in_progress' && styles.inProgressBadge,
                    ]}>
                        <Text style={styles.statusText}>
                            {tournament.status === 'completed' ? '🏆 Completed' :
                             tournament.status === 'in_progress' ? '⚔️ In Progress' :
                             '📝 Registration'}
                        </Text>
                    </View>

                    {tournament.is_registered && tournament.status === 'registration' && (
                        <Text style={styles.registeredText}>✓ You are registered</Text>
                    )}
                </View>

                {/* Start Tournament Button */}
                {canStart && (
                    <View style={styles.startSection}>
                        <TouchableOpacity
                            style={styles.startTournamentButton}
                            onPress={handleStartTournament}
                            disabled={processing}
                        >
                            {processing ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <Text style={styles.startTournamentButtonText}>🏁 Start Tournament</Text>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.startHint}>
                            This will generate the bracket and begin Round 1
                        </Text>
                    </View>
                )}

                {/* Participants List (Registration Phase) */}
                {tournament.status === 'registration' && participants.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>👥 Registered Participants ({participants.length})</Text>
                        {participants.map((p) => (
                            <View key={p.id} style={styles.participantRow}>
                                <Text style={styles.participantAvatar}>{p.user.avatar}</Text>
                                <Text style={styles.participantName}>{p.user.username}</Text>
                                <Text style={styles.participantElo}>{p.user.elo} ELO</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Bracket (In Progress / Completed) */}
                {tournament.status !== 'registration' && matches.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🏆 Tournament Bracket</Text>
                        {roundNumbers.map((roundNum) => {
                            const roundMatches = matches.filter(m => m.round_number === roundNum);
                            const roundName = roundMatches.length === 1 ? 'Finals' :
                                            roundMatches.length === 2 ? 'Semi-Finals' :
                                            `Round ${roundNum}`;

                            return (
                                <View key={roundNum} style={styles.roundSection}>
                                    <Text style={styles.roundTitle}>{roundName}</Text>
                                    {roundMatches.map(renderMatch)}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Winner Display */}
                {tournament.status === 'completed' && tournament.winner_id && (
                    <View style={styles.winnerSection}>
                        <Text style={styles.winnerTitle}>🏆 Champion</Text>
                        {participants.find(p => p.user.id === tournament.winner_id) && (
                            <View style={styles.winnerCard}>
                                <Text style={styles.winnerAvatar}>
                                    {participants.find(p => p.user.id === tournament.winner_id)?.user.avatar}
                                </Text>
                                <Text style={styles.winnerName}>
                                    {participants.find(p => p.user.id === tournament.winner_id)?.user.username}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 16,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        padding: 8,
    },
    backText: {
        fontSize: 28,
        color: COLORS.primary,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    content: {
        flex: 1,
    },
    infoCard: {
        backgroundColor: 'white',
        padding: 20,
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    tournamentName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    tournamentMeta: {
        fontSize: 16,
        color: '#666',
        marginBottom: 4,
    },
    tournamentParticipants: {
        fontSize: 14,
        color: '#888',
        marginBottom: 12,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#999',
        marginBottom: 8,
    },
    completedBadge: {
        backgroundColor: '#FFD700',
    },
    inProgressBadge: {
        backgroundColor: '#FF6B6B',
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    registeredText: {
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '600',
    },
    startSection: {
        padding: 20,
        backgroundColor: 'white',
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    startTournamentButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 8,
    },
    startTournamentButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    startHint: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
    },
    section: {
        backgroundColor: 'white',
        padding: 20,
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E0E0E0',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },
    participantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    participantAvatar: {
        fontSize: 24,
        marginRight: 12,
    },
    participantName: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    participantElo: {
        fontSize: 14,
        color: '#666',
    },
    roundSection: {
        marginBottom: 24,
    },
    roundTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    matchCard: {
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    matchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    matchNumber: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    matchStatusBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#DDD',
        justifyContent: 'center',
        alignItems: 'center',
    },
    matchStatusText: {
        fontSize: 14,
    },
    playersContainer: {
        marginBottom: 12,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: 'white',
        borderRadius: 8,
        marginBottom: 6,
    },
    winnerRow: {
        backgroundColor: COLORS.primaryLight,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    playerAvatar: {
        fontSize: 20,
        marginRight: 10,
    },
    playerName: {
        flex: 1,
        fontSize: 15,
        color: '#333',
        fontWeight: '500',
    },
    winnerIcon: {
        fontSize: 16,
    },
    vsContainer: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    vsText: {
        fontSize: 12,
        color: '#999',
        fontWeight: 'bold',
    },
    startMatchButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    startMatchButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    winnerSection: {
        backgroundColor: '#FFF9E6',
        padding: 24,
        marginTop: 12,
        borderTopWidth: 2,
        borderBottomWidth: 2,
        borderColor: '#FFD700',
        alignItems: 'center',
    },
    winnerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },
    winnerCard: {
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#FFD700',
    },
    winnerAvatar: {
        fontSize: 48,
        marginBottom: 12,
    },
    winnerName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#999',
    },
});
