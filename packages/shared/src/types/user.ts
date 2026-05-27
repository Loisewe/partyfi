export interface PublicUser {
  id: string
  name: string | null
  nickname: string | null // for anonymous users: "Mysterious Alpaca"
  avatarUrl: string | null
  isAnonymous: boolean
}

export interface AuthenticatedUser extends PublicUser {
  email: string
  isAnonymous: false
}
