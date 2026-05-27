// Funny, non-offensive nickname generator for anonymous users.
// Pattern: [Adjective] [Animal] — like Pure chat naming.
// 100 × 100 = 10,000 unique combinations.

const ADJECTIVES = [
  'Mysterious', 'Witty', 'Cosmic', 'Fluffy', 'Sneaky',
  'Elegant', 'Brave', 'Curious', 'Dazzling', 'Grumpy',
  'Jolly', 'Clumsy', 'Mighty', 'Gentle', 'Fierce',
  'Sleepy', 'Hungry', 'Sparkly', 'Bouncy', 'Wobbly',
  'Dizzy', 'Fuzzy', 'Jumpy', 'Lazy', 'Moody',
  'Nerdy', 'Oddly', 'Perky', 'Quirky', 'Rowdy',
  'Silly', 'Tiny', 'Uppity', 'Vivid', 'Wacky',
  'Zany', 'Artsy', 'Bashful', 'Chatty', 'Dreamy',
  'Earthy', 'Fancy', 'Goofy', 'Happy', 'Icy',
  'Kooky', 'Lofty', 'Misty', 'Noble', 'Oafy',
  'Peppy', 'Queenly', 'Royal', 'Sassy', 'Tasty',
  'Urban', 'Velvety', 'Wiggly', 'Xenial', 'Yappy',
  'Zesty', 'Absurd', 'Bold', 'Calm', 'Daring',
  'Epic', 'Funky', 'Grumbling', 'Heroic', 'Ideal',
  'Jovial', 'Keen', 'Lively', 'Mellow', 'Nimble',
  'Optic', 'Plucky', 'Quippy', 'Rustic', 'Stormy',
  'Tangy', 'Ultra', 'Vast', 'Warm', 'Xtra',
  'Youthful', 'Zeal', 'Agile', 'Breezy', 'Crispy',
  'Dapper', 'Exotic', 'Frugal', 'Glossy', 'Hyper',
  'Icy', 'Jaunty', 'Kinky', 'Lunar', 'Mystical',
]

const ANIMALS = [
  'Alpaca', 'Penguin', 'Narwhal', 'Capybara', 'Axolotl',
  'Platypus', 'Quokka', 'Okapi', 'Pangolin', 'Fennec',
  'Meerkat', 'Tapir', 'Kinkajou', 'Binturong', 'Fossa',
  'Numbat', 'Wombat', 'Echidna', 'Tamandua', 'Coati',
  'Pika', 'Viscacha', 'Patagotitan', 'Dugong', 'Manatee',
  'Gharial', 'Axolotl', 'Mudskipper', 'Blobfish', 'Degu',
  'Chinchilla', 'Lemur', 'Aye-aye', 'Loris', 'Tarsier',
  'Galago', 'Margay', 'Ocelot', 'Serval', 'Caracal',
  'Clouded Leopard', 'Pronghorn', 'Saiga', 'Nilgai', 'Gerenuk',
  'Klipspringer', 'Dik-dik', 'Bongo', 'Okapi', 'Gerenuk',
  'Babirusa', 'Tapir', 'Peccary', 'Capybara', 'Hutia',
  'Pacarana', 'Mara', 'Tuco-tuco', 'Vizcacha', 'Agouti',
  'Porcupine', 'Hedgehog', 'Shrew', 'Mole', 'Vole',
  'Jerboa', 'Kangaroo Rat', 'Dormouse', 'Harvest Mouse', 'Fieldmouse',
  'Stoat', 'Ferret', 'Mink', 'Wolverine', 'Fisher',
  'Tayra', 'Grison', 'Zorilla', 'Civet', 'Linsang',
  'Fanaloka', 'Falanouc', 'Mongoose', 'Meerkat', 'Banded Mongoose',
  'Honey Badger', 'Kinkajou', 'Ringtail', 'Cacomistle', 'Olingo',
  'Coati', 'Raccoon', 'Red Panda', 'Binturong', 'Palm Civet',
  'Quoll', 'Quokka', 'Potoroo', 'Bettong', 'Pademelon',
]

// Ensure uniqueness of animals (remove duplicates from the list above)
const UNIQUE_ANIMALS = [...new Set(ANIMALS)]

export function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!
  const animal = UNIQUE_ANIMALS[Math.floor(Math.random() * UNIQUE_ANIMALS.length)]!
  return `${adj} ${animal}`
}

// Generate a deterministic nickname from a user ID (for consistent display)
export function nicknameFromId(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // convert to 32-bit int
  }
  const absHash = Math.abs(hash)
  const adj = ADJECTIVES[absHash % ADJECTIVES.length]!
  const animal = UNIQUE_ANIMALS[(absHash >> 8) % UNIQUE_ANIMALS.length]!
  return `${adj} ${animal}`
}
