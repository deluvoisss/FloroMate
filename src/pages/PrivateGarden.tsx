import React, { useState } from 'react';
import './PersonalGarden.css';

// ========================
// TYPES
// ========================
interface Post {
  id: string;
  title: string;
  description: string;
  author: string;
  authorInitial: string;
  date: string;
  tags: string[];
  category: 'tips' | 'achievements';
  likes: number;
  comments: any[];
  userLiked?: boolean;
}

interface Task {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  urgent: boolean;
  description?: string;
}

interface WateringSchedule {
  plant: string;
  frequency: string;
  amount: string;
  description: string;
}

interface FertilizerSchedule {
  id: string;
  name: string;
  type: string;
  schedule: string;
  amount: string;
  description: string;
}

interface DiaryEntryType {
  id: string;
  date: string;
  title: string;
  photo?: string;
  text: string;
}

interface HarvestEntry {
  date: string;
  amount: number;
}

const PersonalGarden: React.FC = () => {
  const [mode, setMode] = useState<'personal' | 'community'>('personal');
  const [activeTab, setActiveTab] = useState<'diary' | 'tasks' | 'fertilizer' | 'watering' | 'stats'>('diary');
  const [communityTab, setCommunityTab] = useState<'tips' | 'achievements'>('tips');
  
  const [showAIModal, setShowAIModal] = useState(false);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [showCommunityPostModal, setShowCommunityPostModal] = useState(false);
  
  const [aiMessage, setAIMessage] = useState('');
  const [aiLoading, setAILoading] = useState(false);
  const [aiResults, setAIResults] = useState<any>(null);
  const [showAIResultsModal, setShowAIResultsModal] = useState(false);

  const currentUser = 'Вы';
  const currentUserInitial = 'В';

  const [newDiaryPhoto, setNewDiaryPhoto] = useState<File | null>(null);
const [newDiaryPhotoPreview, setNewDiaryPhotoPreview] = useState<string | null>(null);

  // Для добавления задачи
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', dueDate: '', urgent: false, description: '' });

  // Для добавления полива
  const [showWateringModal, setShowWateringModal] = useState(false);
  const [newWatering, setNewWatering] = useState({ plant: '', frequency: '', amount: '', description: '' });

  // Для добавления удобрения
  const [showFertilizerModal, setShowFertilizerModal] = useState(false);
  const [newFertilizer, setNewFertilizer] = useState({ name: '', type: 'минеральное', schedule: '', amount: '', description: '' });

  // ========================
  // STATE - ДАННЫЕ САДА
  // ========================
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Полив помидоров', dueDate: '2025-12-22', completed: false, urgent: true },
    { id: '2', title: 'Подкормка огурцов', dueDate: '2025-12-22', completed: false, urgent: false },
    { id: '3', title: 'Рыхление грядок', dueDate: '2025-12-23', completed: true, urgent: false },
    { id: '4', title: 'Обработка вредителей', dueDate: '2025-12-24', completed: false, urgent: true },
  ]);

  const [wateringSchedule, setWateringSchedule] = useState<WateringSchedule[]>([
    { plant: 'Помидоры', frequency: 'каждый день', amount: '1-2 литра', description: 'Поливать под корень' },
    { plant: 'Огурцы', frequency: 'через день', amount: '1.5 литра', description: 'Утром или вечером' },
    { plant: 'Зелень', frequency: '2 раза в день', amount: '0.5 литра', description: 'Опрыскивание' },
  ]);

  const [fertilizerSchedule, setFertilizerSchedule] = useState<FertilizerSchedule[]>([
    { id: '1', name: 'Азотные удобрения', type: 'минеральное', schedule: 'каждую неделю', amount: '10 грамм на литр', description: 'Для роста листьев' },
    { id: '2', name: 'Фосфорные удобрения', type: 'минеральное', schedule: 'раз в 2 недели', amount: '5 грамм на литр', description: 'Для развития корней' },
    { id: '3', name: 'Компост', type: 'органическое', schedule: 'раз в месяц', amount: '2-3 литра', description: 'Улучшение почвы' },
  ]);

  const [diaryEntries, setDiaryEntries] = useState<DiaryEntryType[]>([
    { id: '1', date: '2025-12-21', title: 'Отличный день для посадок', text: 'Сегодня посадил новые семена зелени. Погода была идеальной, температура стабильная.' },
    { id: '2', date: '2025-12-19', title: 'Урожай превзошел ожидания', text: 'Собрал более 50 кг помидоров в этом сезоне! Это был лучший урожай за все годы.' },
  ]);

  const [newDiaryEntry, setNewDiaryEntry] = useState({ title: '', text: '' });
  const [newCommunityPost, setNewCommunityPost] = useState({ title: '', description: '', tags: '' });

  const [harvestHistory, setHarvestHistory] = useState<HarvestEntry[]>([
    { date: '2025-12-21', amount: 5 },
    { date: '2025-12-20', amount: 3 },
    { date: '2025-12-19', amount: 8 },
    { date: '2025-12-18', amount: 4 },
  ]);
  const [newHarvestAmount, setNewHarvestAmount] = useState('');

  const [communityPosts, setCommunityPosts] = useState<Post[]>([
    {
      id: '1',
      title: 'Борьба с вредителями: натуральные методы',
      description: 'Избавляюсь от вредителей без химии. Использую отвар чеснока и мыльный раствор.',
      author: 'Татьяна Волкова',
      authorInitial: 'Т',
      date: '2025-12-21',
      tags: ['вредители', 'эко-способы', 'защита'],
      category: 'tips',
      likes: 89,
      userLiked: false,
      comments: []
    },
    {
      id: '2',
      title: 'Рекорд урожая огурцов!',
      description: 'Собрал 120 кг огурцов с одной грядки! Поделюсь секретом успеха.',
      author: 'Иван Петров',
      authorInitial: 'И',
      date: '2025-12-20',
      tags: ['огурцы', 'урожай', 'достижение'],
      category: 'achievements',
      likes: 156,
      userLiked: false,
      comments: []
    },
  ]);

  const totalHarvest = harvestHistory.reduce((sum, entry) => sum + entry.amount, 0);

  // ========================
  // AI HANDLER
  // ========================
  const handleAIRequest = async () => {
    if (!aiMessage.trim()) {
      alert('❌ Введите описание проблемы');
      return;
    }

    setAILoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/garden-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: aiMessage,
          gardenContext: { tasks, watering: wateringSchedule, fertilizer: fertilizerSchedule, diaryEntries },
        }),
      });

      const data = await response.json();
      console.log('📦 Ответ от backend:', data);

      if (data.error) throw new Error(data.error);

      const aiTasks: Task[] = (data.tasks || []).map((t: any, i: number) => ({
        id: `ai-task-${Date.now()}-${i}`,
        title: t.title || `Действие ${i + 1}`,
        dueDate: t.dueDate || new Date().toISOString().split('T')[0],
        completed: false,
        urgent: !!t.urgent,
        description: t.description || '',
      }));

      const aiWatering: WateringSchedule[] = (data.watering || []).map((w: any) => ({
        plant: w.plant || 'Растение',
        frequency: w.frequency || 'по необходимости',
        amount: w.amount || 'смотри описание',
        description: w.description || '',
      }));

      const aiFertilizer: FertilizerSchedule[] = (data.fertilizer || []).map((f: any, i: number) => ({
        id: `ai-fert-${Date.now()}-${i}`,
        name: f.name || `Удобрение ${i + 1}`,
        type: f.type || 'комплексное',
        schedule: f.schedule || 'раз в неделю',
        amount: f.amount || 'смотри описание',
        description: f.description || '',
      }));

      const diaryEntry: DiaryEntryType = {
        id: `ai-entry-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        title: data.diaryEntry?.title || '🤖 Анализ от AI',
        text: data.diaryEntry?.text || data.analysis,
      };

      setTasks((prev) => [...prev, ...aiTasks]);
      if (aiWatering.length > 0) setWateringSchedule((prev) => [...prev, ...aiWatering]);
      if (aiFertilizer.length > 0) setFertilizerSchedule((prev) => [...prev, ...aiFertilizer]);
      setDiaryEntries((prev) => [diaryEntry, ...prev]);

      setAIResults({
  analysis: data.analysis,
  tasks: aiTasks,
  watering: aiWatering,
  fertilizer: aiFertilizer,
  diaryEntry: data.diaryEntry,
  tasksCount: aiTasks.length,
  wateringCount: aiWatering.length,
  fertilizerCount: aiFertilizer.length,
});

      setShowAIResultsModal(true);
      setShowAIModal(false);
      setAIMessage('');
    } catch (error) {
      console.error('Ошибка:', error);
      alert('❌ Ошибка при обработке запроса.\n\nПроверь:\n1. Запущен ли backend на localhost:3001?\n2. Есть ли роут /api/garden-chat?');
    } finally {
      setAILoading(false);
    }
  };

  // ========================
  // HANDLERS
  // ========================
  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

 const addDiaryEntry = () => {
  if (newDiaryEntry.title && newDiaryEntry.text) {
    const newEntry: DiaryEntryType & { photo?: string } = {
      id: `diary-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      title: newDiaryEntry.title,
      text: newDiaryEntry.text,
      photo: newDiaryPhotoPreview || undefined, // preview URL для отображения
    };
    setDiaryEntries([newEntry, ...diaryEntries]);
    setNewDiaryEntry({ title: '', text: '' });
    setNewDiaryPhoto(null);
    setNewDiaryPhotoPreview(null);
    setShowDiaryModal(false);
  }
};

  const addHarvestEntry = () => {
    if (newHarvestAmount && parseFloat(newHarvestAmount) > 0) {
      const today = new Date().toISOString().split('T')[0];
      const existing = harvestHistory.findIndex(h => h.date === today);
      
      if (existing >= 0) {
        const updated = [...harvestHistory];
        updated[existing].amount += parseFloat(newHarvestAmount);
        setHarvestHistory(updated);
      } else {
        setHarvestHistory([{ date: today, amount: parseFloat(newHarvestAmount) }, ...harvestHistory]);
      }
      
      setNewHarvestAmount('');
      setShowHarvestModal(false);
    }
  };

  const addCommunityPost = () => {
    if (newCommunityPost.title && newCommunityPost.description) {
      const post: Post = {
        id: Date.now().toString(),
        title: newCommunityPost.title,
        description: newCommunityPost.description,
        author: currentUser,
        authorInitial: currentUserInitial,
        date: new Date().toISOString().split('T')[0],
        tags: newCommunityPost.tags.split(',').map(t => t.trim()).filter(Boolean),
        category: communityTab as 'tips' | 'achievements',
        likes: 0,
        userLiked: false,
        comments: []
      };
      setCommunityPosts([post, ...communityPosts]);
      setNewCommunityPost({ title: '', description: '', tags: '' });
      setShowCommunityPostModal(false);
    }
  };

  const todayTasks = tasks.filter(t => new Date(t.dueDate).toDateString() === new Date().toDateString());
  const weekTasks = tasks.filter(t => {
    const taskDate = new Date(t.dueDate);
    const today = new Date();
    const diff = taskDate.getTime() - today.getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  });

  const filteredCommunityPosts = communityPosts.filter(p => p.category === communityTab);


    const addTask = () => {
    if (newTask.title && newTask.dueDate) {
      const task: Task = {
        id: `task-${Date.now()}`,
        title: newTask.title,
        dueDate: newTask.dueDate,
        completed: false,
        urgent: newTask.urgent,
        description: newTask.description || undefined,
      };
      setTasks([task, ...tasks]);
      setNewTask({ title: '', dueDate: '', urgent: false, description: '' });
      setShowTaskModal(false);
    }
  };

  const addWatering = () => {
    if (newWatering.plant && newWatering.frequency) {
      setWateringSchedule([newWatering, ...wateringSchedule]);
      setNewWatering({ plant: '', frequency: '', amount: '', description: '' });
      setShowWateringModal(false);
    }
  };

  const addFertilizer = () => {
    if (newFertilizer.name && newFertilizer.schedule) {
      const fertilizer: FertilizerSchedule = {
        id: `fert-${Date.now()}`,
        ...newFertilizer,
      };
      setFertilizerSchedule([fertilizer, ...fertilizerSchedule]);
      setNewFertilizer({ name: '', type: 'минеральное', schedule: '', amount: '', description: '' });
      setShowFertilizerModal(false);
    }
  };
  // ========================
  // RENDER
  // ========================
  return (
  <div className="personal-garden-app">
    <div className="app-container">
      {/* КНОПКА ПЕРЕКЛЮЧЕНИЯ В ПРАВОМ НИЖНЕМ УГЛУ */}
      <button
        className="mode-toggle-btn"
        onClick={() => setMode(mode === 'personal' ? 'community' : 'personal')}
        title={mode === 'personal' ? 'Перейти в сообщество' : 'Вернуться в личный сад'}
      >
        {mode === 'personal' ? '👥' : '🌱'}
      </button>

      {mode === 'personal' && (
        <>
          <div className="main-content-wrapper">
            <div className="header-section">
              <h1 className="app-title">
                <span className="title-emoji">🌱</span>Мой Личный Сад
              </h1>
            </div>

            {/* 5 ВКЛАДОК */}
            <div className="tabs-container">
              {['diary', 'tasks', 'fertilizer', 'watering', 'stats'].map((tab, idx) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`tab-btn ${activeTab === tab ? 'tab-btn--active' : ''}`}
                >
                  {idx === 0 && '📖 Дневник'}
                  {idx === 1 && '✅ Задачи'}
                  {idx === 2 && '🌿 Удобрения'}
                  {idx === 3 && '💧 Полив'}
                  {idx === 4 && '📊 Статистика'}
                </button>
              ))}
              
              <button
                className="ai-btn"
                onClick={() => setShowAIModal(true)}
              >
                🤖 AI Помощник
              </button>
            </div>

            {/* ВКЛАДКА 1: ДНЕВНИК */}
            {activeTab === 'diary' && (
  <div className="tab-content">
    <div className="content-header">
      <button className="btn-primary" onClick={() => setShowDiaryModal(true)}>
        ➕ Новая запись
      </button>
    </div>
    <div className="cards-list">
      {diaryEntries.length > 0 ? (
        diaryEntries.map(entry => (
          <div key={entry.id} className="diary-card">
            <div className="card-date">📅 {new Date(entry.date).toLocaleDateString('ru-RU')}</div>
            <div className="card-title">{entry.title}</div>
            {entry.photo && (
              <img src={entry.photo} alt="Фото записи" className="diary-photo" />
            )}
            <p className="card-text">{entry.text}</p>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <div className="empty-emoji">📝</div>
          <p>Нет записей</p>
        </div>
      )}
    </div>
  </div>
)}

            {/* ВКЛАДКА 2: ЗАДАЧИ */}
            {activeTab === 'tasks' && (
              <div className="tab-content">
    <div className="content-header">
     
      <button className="btn-primary" onClick={() => setShowTaskModal(true)}>
        ➕ Новая задача
      </button>
    </div>
                <div className="tasks-section">
                  <h3 className="subsection-title">📅 На сегодня ({todayTasks.length})</h3>
                  {todayTasks.length > 0 ? (
                    <div className="tasks-list">
                      {todayTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => toggleTask(task.id)}
                          className="task-item"
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => {}}
                            className="task-checkbox"
                          />
                          <div className="task-content">
                            <div className={`task-title ${task.completed ? 'task-title--completed' : ''}`}>
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="task-description">{task.description}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-text">Нет задач на сегодня</div>
                  )}
                </div>

                <div className="tasks-section">
                  <h3 className="subsection-title">📆 На неделю ({weekTasks.length})</h3>
                  {weekTasks.length > 0 ? (
                    <div className="tasks-list">
                      {weekTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => toggleTask(task.id)}
                          className="task-item task-item--week"
                        >
                          <div className="task-content">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => {}}
                              className="task-checkbox"
                            />
                            <div>
                              <div className={`task-title ${task.completed ? 'task-title--completed' : ''}`}>
                                {task.title}
                              </div>
                              {task.description && (
                                <div className="task-description">{task.description}</div>
                              )}
                            </div>
                          </div>
                          <div className="task-date">
                            {new Date(task.dueDate).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-text">Нет задач на неделю</div>
                  )}
                </div>
              </div>
            )}

            {/* ВКЛАДКА 3: УДОБРЕНИЯ */}
            {activeTab === 'fertilizer' && (
              <div className="tab-content">
          <div className="content-header">
      
      <button className="btn-primary" onClick={() => setShowFertilizerModal(true)}>
        ➕ Добавить удобрение
      </button>
    </div>
                {fertilizerSchedule.length > 0 ? (
                  <div className="cards-list">
                    {fertilizerSchedule.map(f => (
                      <div key={f.id} className="schedule-card schedule-card--fertilizer">
                        <div className="card-title">{f.name}</div>
                        <div className="card-meta">🏷️ {f.type} • {f.schedule}</div>
                        <div className="card-meta">📏 {f.amount}</div>
                        <div className="card-description">{f.description}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-emoji">🌾</div>
                    <p>Нет удобрений</p>
                  </div>
                )}
              </div>
            )}

            {/* ВКЛАДКА 4: ПОЛИВ */}
            {activeTab === 'watering' && (
              <div className="tab-content">
       <div className="content-header">
      
      <button className="btn-primary" onClick={() => setShowWateringModal(true)}>
        ➕ Добавить режим полива
      </button>
    </div>
                {wateringSchedule.length > 0 ? (
                  <div className="cards-list">
                    {wateringSchedule.map((w, i) => (
                      <div key={i} className="schedule-card schedule-card--watering">
                        <div className="card-title">{w.plant}</div>
                        <div className="card-meta"> {w.frequency} • {w.amount}</div>
                        <div className="card-description">{w.description}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-emoji">💧</div>
                    <p>Нет режимов полива</p>
                  </div>
                )}
              </div>
            )}

            {/* ВКЛАДКА 5: СТАТИСТИКА */}
            {activeTab === 'stats' && (
              <div className="tab-content">
         <div className="content-header">
      
      <button className="btn-primary" onClick={() => setShowHarvestModal(true)}>
        ➕ Добавить урожай
      </button>
</div>
                <div className="stats-grid">
                  <div className="stat-card stat-card--harvest">
                    <div className="stat-value">{totalHarvest}</div>
                    <div className="stat-label">Урожай за сезон (кг)</div>
                  </div>

                  <div className="stat-card stat-card--days">
                    <div className="stat-value">{harvestHistory.length}</div>
                    <div className="stat-label">Дней сбора</div>
                  </div>

                  <div className="stat-card stat-card--average">
                    <div className="stat-value">{(totalHarvest / harvestHistory.length).toFixed(1)}</div>
                    <div className="stat-label">Среднее в день (кг)</div>
                  </div>
                </div>

                <div className="harvest-header">
                  <h3 className="subsection-title">История сбора урожая</h3>
                 
                </div>

                <div className="harvest-list">
                  {harvestHistory.length > 0 ? (
                    harvestHistory.map((entry, i) => (
                      <div key={i} className="harvest-item">
                        <div className="harvest-date">
                          {new Date(entry.date).toLocaleDateString('ru-RU')}
                        </div>
                        <div className="harvest-amount">+{entry.amount} кг</div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-text-centered">Нет записей урожая</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {mode === 'community' && (
        <>
          <div className="main-content-wrapper">
            <div className="header-section">
              <h1 className="app-title">
                <span className="title-emoji">👥</span>Сообщество Садоводов
              </h1>

            </div>

            <div className="community-tabs">
              <button
                onClick={() => setCommunityTab('tips')}
                className={`community-tab-btn ${communityTab === 'tips' ? 'community-tab-btn--active' : ''}`}
              >
                💡 Советы
              </button>
              <button
                onClick={() => setCommunityTab('achievements')}
                className={`community-tab-btn ${communityTab === 'achievements' ? 'community-tab-btn--active' : ''}`}
              >
                🏆 Достижения
              </button>
              <button
                onClick={() => setShowCommunityPostModal(true)}
                className="btn-primary btn-primary--community"
              >
                ➕ Поделиться
              </button>
            </div>

            {filteredCommunityPosts.length > 0 ? (
              <div className="cards-list">
                {filteredCommunityPosts.map(post => (
                  <div key={post.id} className="community-card">
                    <div className="community-card-title">{post.title}</div>
                    <div className="community-card-meta">👤 {post.author} • {post.date}</div>
                    <p className="community-card-text">{post.description}</p>
                    <div className="tags-container">
                      {post.tags.map((tag, i) => (
                        <span key={i} className="tag">#{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-emoji">📝</div>
                <p>Нет постов</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* МОДАЛЬНЫЕ ОКНА */}

            {/* МОДАЛКА НОВАЯ ЗАДАЧА */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">➕ Новая задача</h2>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Название</label>
                <input type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Дата выполнения</label>
                <input type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">
                  <input type="checkbox" checked={newTask.urgent} onChange={e => setNewTask({...newTask, urgent: e.target.checked})} />
                  Срочная
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Описание (необязательно)</label>
                <textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="form-textarea" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowTaskModal(false)}>Отмена</button>
              <button className="btn-primary" onClick={addTask}>Добавить</button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА НОВЫЙ РЕЖИМ ПОЛИВА */}
      {showWateringModal && (
        <div className="modal-overlay" onClick={() => setShowWateringModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">💧 Новый режим полива</h2>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Растение</label>
                <input type="text" value={newWatering.plant} onChange={e => setNewWatering({...newWatering, plant: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Частота</label>
                <input type="text" placeholder="например: каждый день" value={newWatering.frequency} onChange={e => setNewWatering({...newWatering, frequency: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Объём</label>
                <input type="text" placeholder="например: 1-2 литра" value={newWatering.amount} onChange={e => setNewWatering({...newWatering, amount: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Описание</label>
                <textarea value={newWatering.description} onChange={e => setNewWatering({...newWatering, description: e.target.value})} className="form-textarea" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowWateringModal(false)}>Отмена</button>
              <button className="btn-primary" onClick={addWatering}>Добавить</button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА НОВОЕ УДОБРЕНИЕ */}
      {showFertilizerModal && (
        <div className="modal-overlay" onClick={() => setShowFertilizerModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🌿 Новое удобрение</h2>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Название</label>
                <input type="text" value={newFertilizer.name} onChange={e => setNewFertilizer({...newFertilizer, name: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Тип</label>
                <select value={newFertilizer.type} onChange={e => setNewFertilizer({...newFertilizer, type: e.target.value})} className="form-input">
                  <option value="минеральное">Минеральное</option>
                  <option value="органическое">Органическое</option>
                  <option value="комплексное">Комплексное</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">График</label>
                <input type="text" placeholder="например: каждую неделю" value={newFertilizer.schedule} onChange={e => setNewFertilizer({...newFertilizer, schedule: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Дозировка</label>
                <input type="text" value={newFertilizer.amount} onChange={e => setNewFertilizer({...newFertilizer, amount: e.target.value})} className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">Описание</label>
                <textarea value={newFertilizer.description} onChange={e => setNewFertilizer({...newFertilizer, description: e.target.value})} className="form-textarea" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowFertilizerModal(false)}>Отмена</button>
              <button className="btn-primary" onClick={addFertilizer}>Добавить</button>
            </div>
          </div>
        </div>
      )}
      {/* AI MODAL */}
      {showAIModal && (
        <div className="modal-overlay" onClick={() => setShowAIModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🤖 AI Помощник для сада</h2>
            <div className="modal-body">
              <label className="form-label">Ваше описание проблемы</label>
              <textarea
                placeholder="Пример: у меня помидоры болеют, листья желтеют и опадают. Нужна помощь!"
                value={aiMessage}
                onChange={e => setAIMessage(e.target.value)}
                className="form-textarea"
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowAIModal(false)}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={handleAIRequest}
                disabled={aiLoading}
                className={`btn-primary ${aiLoading ? 'btn-primary--loading' : ''}`}
              >
                {aiLoading ? '⏳ Обработка...' : '🤖 Получить рекомендации'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* РЕЗУЛЬТАТЫ AI MODAL */}
      {showAIResultsModal && (
  <div className="modal-overlay" onClick={() => setShowAIResultsModal(false)}>
    <div 
      className="modal ai-analysis-modal" 
      onClick={e => e.stopPropagation()}
    >
      {/* Заголовок */}
      <h2 className="modal-title">Анализ от AI</h2>

      {/* Основное содержимое */}
      <div className="modal-body">
        <div className="ai-analysis-content">

          {/* 1. АНАЛИЗ */}
          <section className="ai-analysis-section">
            <h3 className="ai-analysis-section__title">
              🔍 Анализ проблемы
            </h3>
            <p className="ai-analysis-section__content">
              {aiResults?.analysis || 'Нет данных анализа'}
            </p>
          </section>

          {/* 2. ЗАДАЧИ */}
          {aiResults?.tasks && aiResults.tasks.length > 0 && (
            <section className="ai-analysis-section ai-tasks-section">
              <h3 className="ai-analysis-section__title">
                Рекомендуемые задачи
              </h3>
              <div className="ai-tasks-list">
                {aiResults.tasks.map((task: any, index: number) => (
                  <div key={index} className="ai-task-item">
                    <div className="ai-task-title">
                      {task.title}
                      {task.urgent && <span className="ai-task-urgent">Срочно!</span>}
                    </div>
                    {task.dueDate && (
                      <div className="ai-task-due">
                        До: {new Date(task.dueDate).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                    <div className="ai-task-description">
                      {task.description}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. ПОЛИВ */}
          {aiResults?.watering && aiResults.watering.length > 0 && (
            <section className="ai-analysis-section ai-watering-section">
              <h3 className="ai-analysis-section__title">
                Режимы полива
              </h3>
              <div className="ai-watering-list">
                {aiResults.watering.map((item: any, index: number) => (
                  <div key={index} className="ai-watering-item">
                    <div className="ai-watering-plant">{item.plant}</div>
                    <div className="ai-watering-details">
                      <strong>Частота:</strong> {item.frequency}<br />
                      <strong>Объём:</strong> {item.amount}<br />
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4. УДОБРЕНИЯ */}
          {aiResults?.fertilizer && aiResults.fertilizer.length > 0 && (
            <section className="ai-analysis-section ai-fertilizer-section">
              <h3 className="ai-analysis-section__title">
                Рекомендуемые удобрения
              </h3>
              <div className="ai-fertilizer-list">
                {aiResults.fertilizer.map((item: any, index: number) => (
                  <div key={index} className="ai-fertilizer-item">
                    <div className="ai-fertilizer-name">
                      {item.name}
                      <span className="ai-fertilizer-type">{item.type}</span>
                    </div>
                    <div className="ai-fertilizer-details">
                      <strong>График:</strong> {item.schedule}<br />
                      <strong>Дозировка:</strong> {item.amount}<br />
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 5. ЗАПИСЬ В ДНЕВНИК */}
          {aiResults?.diaryEntry && (
            <section className="ai-analysis-section ai-diary-section">
              <h3 className="ai-analysis-section__title">
                Запись в дневник сада
              </h3>
              <div className="ai-diary-entry">
                <div className="ai-diary-title">
                  {aiResults.diaryEntry.title}
                </div>
                <div className="ai-diary-text">
                  {aiResults.diaryEntry.text}
                </div>
              </div>
            </section>
          )}

          {/* Если ничего нет — заглушка */}
          {(!aiResults?.tasks?.length && !aiResults?.watering?.length && !aiResults?.fertilizer?.length && !aiResults?.diaryEntry) && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Рекомендаций не найдено
            </p>
          )}
        </div>
      </div>

      {/* Футер с кнопкой */}
      <div className="modal-footer">
        <button
          onClick={() => setShowAIResultsModal(false)}
          className="btn-primary"
        >
          ✅ Готово
        </button>
      </div>
    </div>
  </div>
)}

      {/* ДНЕВНИК MODAL */}
     {showDiaryModal && (
  <div className="modal-overlay" onClick={() => setShowDiaryModal(false)}>
    <div className="modal modal--diary" onClick={e => e.stopPropagation()}>
      <h2 className="modal-title">📖 Новая запись в дневник</h2>
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Тема</label>
          <input
            type="text"
            placeholder="Введите тему записи..."
            value={newDiaryEntry.title}
            onChange={e => setNewDiaryEntry({ ...newDiaryEntry, title: e.target.value })}
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Описание</label>
          <textarea
            placeholder="Напишите подробно о том, что произошло в саду..."
            value={newDiaryEntry.text}
            onChange={e => setNewDiaryEntry({ ...newDiaryEntry, text: e.target.value })}
            className="form-textarea"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Фото</label>
          <label className="file-upload-btn">
            📷 Выбрать фото
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setNewDiaryPhoto(file);
                  setNewDiaryPhotoPreview(URL.createObjectURL(file));
                }
              }}
              className="hidden-file-input"
            />
          </label>
          {newDiaryPhotoPreview && (
            <div className="photo-preview">
              <img src={newDiaryPhotoPreview} alt="Превью фото" />
              <button
                className="remove-photo-btn"
                onClick={() => {
                  setNewDiaryPhoto(null);
                  setNewDiaryPhotoPreview(null);
                }}
              >
                ✕ Удалить
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={() => setShowDiaryModal(false)}>
          Отмена
        </button>
        <button className="btn-primary" onClick={addDiaryEntry}>
          Сохранить
        </button>
      </div>
    </div>
  </div>
)}

      {/* УРОЖАЙ MODAL */}
      {showHarvestModal && (
        <div className="modal-overlay" onClick={() => setShowHarvestModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">🌽 Добавить урожай</h2>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Количество урожая (кг)</label>
                <input
                  type="number"
                  placeholder="Введите количество килограмм..."
                  value={newHarvestAmount}
                  onChange={e => setNewHarvestAmount(e.target.value)}
                  min="0"
                  step="0.5"
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowHarvestModal(false)}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={addHarvestEntry}
                className="btn-primary"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMMUNITY POST MODAL */}
      {showCommunityPostModal && (
        <div className="modal-overlay" onClick={() => setShowCommunityPostModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">✨ Поделиться в сообществе</h2>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Заголовок</label>
                <input
                  type="text"
                  placeholder="Введите заголовок..."
                  value={newCommunityPost.title}
                  onChange={e => setNewCommunityPost({ ...newCommunityPost, title: e.target.value })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Описание</label>
                <textarea
                  placeholder="Расскажите о вашем опыте или достижении..."
                  value={newCommunityPost.description}
                  onChange={e => setNewCommunityPost({ ...newCommunityPost, description: e.target.value })}
                  className="form-textarea"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Теги (через запятую)</label>
                <input
                  type="text"
                  placeholder="огурцы, урожай, совет"
                  value={newCommunityPost.tags}
                  onChange={e => setNewCommunityPost({ ...newCommunityPost, tags: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowCommunityPostModal(false)}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={addCommunityPost}
                className="btn-primary"
              >
                Опубликовать
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default PersonalGarden;
