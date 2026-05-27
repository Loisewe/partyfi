/**
 * Pre-made event templates — pure data, applied client-side to fill the
 * create-event form. No schema changes, no API. Premium templates are
 * marked but applied freely (premium gates apply at field level via
 * the event PATCH route, not at template choice).
 */

export interface EventTemplate {
  id: string
  emoji: string
  title: string
  description: string
  premium?: boolean
  defaults: {
    titlePlaceholder?: string
    descriptionDefault?: string
    pollQuestion?: string
    pollOptions?: string[]
    agendaDefault?: Array<{ time?: string; title: string; description?: string }>
    externalLinksDefault?: Array<{ emoji: string; title: string; url: string }>
    // Hint which coverPreset slug to match in the picker (just hint, not enforced)
    coverPresetHint?: string
  }
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'birthday-classic',
    emoji: '🎂',
    title: 'День рождения',
    description: 'Свечи, торт, плюсваны и сюрприз с подарками',
    defaults: {
      titlePlaceholder: 'Днюха Ани',
      descriptionDefault: 'Приходи поздравить и потусить! Без подарков-обязаловки — есть вишлист.',
      pollQuestion: 'Что-то особенное на ужин?',
      pollOptions: ['Без аллергий', 'Веган', 'Без алкоголя'],
      coverPresetHint: 'birthday-balloons',
    },
  },
  {
    id: 'housewarming',
    emoji: '🏠',
    title: 'Новоселье',
    description: 'Показать квартиру, обмыть, собрать пожелания на быт',
    defaults: {
      titlePlaceholder: 'Новоселье у Серёжи',
      descriptionDefault: 'Заходи смотреть как мы наконец-то въехали 🏡',
      pollQuestion: 'Что принести?',
      pollOptions: ['Вино/просекко', 'Закуски', 'Десерт', 'Ничего, просто приду'],
      coverPresetHint: 'housewarming-keys',
    },
  },
  {
    id: 'casual-party',
    emoji: '🎉',
    title: 'Просто тусовка',
    description: 'Бар, домашка, концерт — без повода',
    defaults: {
      titlePlaceholder: 'Пятница в баре',
      descriptionDefault: 'Без повода, просто хочется людей и нормально провести вечер',
      coverPresetHint: 'party-neon',
    },
  },
  {
    id: 'wedding',
    emoji: '💍',
    title: 'Свадьба',
    description: 'Большой ивент: dress-code, рассадка, агенда',
    premium: true,
    defaults: {
      titlePlaceholder: 'Свадьба Ани и Серёжи',
      descriptionDefault: 'Будем рады видеть всех друзей и родных в этот важный день 💍\n\nDress-code: smart casual в пастельных тонах.',
      pollQuestion: 'Меню',
      pollOptions: ['Мясо', 'Рыба', 'Веган'],
      agendaDefault: [
        { time: '16:00', title: 'Сбор гостей', description: 'Welcome-drink в фойе' },
        { time: '17:00', title: 'Церемония' },
        { time: '18:00', title: 'Фотосессия + коктейли' },
        { time: '19:30', title: 'Ужин' },
        { time: '21:00', title: 'Первый танец + вечеринка' },
      ],
      coverPresetHint: 'wedding-floral',
    },
  },
  {
    id: 'baby-shower',
    emoji: '👶',
    title: 'Бэби-шауэр',
    description: 'Закрытый сбор друзей перед рождением',
    defaults: {
      titlePlaceholder: 'Бэби-шауэр у Кати',
      descriptionDefault: 'Тихий вечер с близкими — гадаем пол, играем в смешное, поздравляем',
      pollQuestion: 'Что подарить?',
      pollOptions: ['Вещи для малыша', 'Книги маме', 'Сертификат в Mothercare', 'Сюрприз'],
      coverPresetHint: 'baby-shower-pastel',
    },
  },
  {
    id: 'conference-talk',
    emoji: '🎤',
    title: 'Митап / лекция',
    description: 'Воркшоп, конференция, рабочий ивент с агендой',
    premium: true,
    defaults: {
      titlePlaceholder: 'Митап про X',
      descriptionDefault: 'Закрытый митап для тех, кто шарит. Стартуем строго в 19:00.',
      agendaDefault: [
        { time: '18:30', title: 'Сбор + welcome-кофе' },
        { time: '19:00', title: 'Талк #1', description: 'Спикер: ...' },
        { time: '19:45', title: 'Перерыв 15 мин' },
        { time: '20:00', title: 'Талк #2', description: 'Спикер: ...' },
        { time: '20:45', title: 'Q&A + нетворкинг' },
      ],
      externalLinksDefault: [
        { emoji: '📋', title: 'Программа полностью', url: 'https://...' },
        { emoji: '🎬', title: 'Запись прошлого', url: 'https://youtube.com/...' },
      ],
      coverPresetHint: 'conference-mic',
    },
  },
  {
    id: 'bachelor-party',
    emoji: '🥃',
    title: 'Мальчишник / девичник',
    description: 'Закрытое, под PIN, с программой на день',
    defaults: {
      titlePlaceholder: 'Мальчишник Серёжи',
      descriptionDefault: 'Только для своих. PIN скажу в личку.\n\nDress-code: что не жалко 😅',
      coverPresetHint: 'party-neon',
    },
  },
  {
    id: 'reunion',
    emoji: '🍻',
    title: 'Встреча выпускников',
    description: 'Школа, универ, бывшие коллеги',
    defaults: {
      titlePlaceholder: '10 лет после школы',
      descriptionDefault: 'Все, кто доехал — давайте увидимся! Большой стол, никаких речей.',
      pollQuestion: 'Сколько лет с выпуска?',
      pollOptions: ['5', '10', '15', '20+'],
      coverPresetHint: 'party-cocktail',
    },
  },
]
