import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, distinctUntilChanged, map, of, shareReplay, switchMap } from 'rxjs';
import { WordMeaning } from '../../Models/WordMeaning';
import { AuthService } from '../auth/auth.service';
import { YoutubeService } from '../youtube/youtube.service';
import VideoHistory from '../../Models/VideoHistory';
import User from '../../Models/User';

@Injectable({
  providedIn: 'root'
})
export class VocabularyService {
  private baseUrl: string = 'http://127.0.0.1:5000';

  something = this.youtubeService.video_id$.pipe()

  vocabularyLocalList = this.authService.getUser()?.videoHistory || [];
  
  vocabularyListSubject = new BehaviorSubject<VideoHistory[]>(this.vocabularyLocalList);
  vocabularyList$ = this.vocabularyListSubject.asObservable();


  constructor(private http: HttpClient, private youtubeService: YoutubeService, private authService: AuthService) {}

  addWordToVocabulary(vocabulary: WordMeaning, videoId: string){

    const user = this.authService.getUser();

    if(user){
      this.updateVocabularyListInDB(user.id, videoId, vocabulary).subscribe((updatedUser) => {
        this.authService.setUser(updatedUser)

        const updatedVocabularyList = updatedUser.videoHistory;

        this.vocabularyListSubject.next(updatedVocabularyList);
      },
      (err) => {
        console.log("Error occured while trying to save new word: ",err)
      })
    }
  }

  updateVocabularyListInDB(userId: string, videoId: string, meaning: WordMeaning): Observable<User>{
    return this.http.post<User>(`${this.baseUrl}/user/vocabulary`, {id: userId, videoId: videoId, vocabulary: meaning})
  }

  private findMeaningSubject = new Subject<string>();
  findMeaning$ = this.findMeaningSubject.asObservable();

  setSearchingWord(word: string){
    this.findMeaningSubject.next(word)
  }  

  wordMeaning$ = this.findMeaning$.pipe(
    distinctUntilChanged((prev, curr) => prev === curr),
    switchMap((word) => {

      const user = this.authService.getUser();
      if(user){
        var filteredVocab: WordMeaning | null = null
        user.videoHistory.forEach((history) => {
          const result = history.vocabList.find((vocab: WordMeaning) => vocab.input === word)
          if(result)
            filteredVocab = result;
        })
        if(filteredVocab) return of(filteredVocab);
      }
      return this.http.post<any>(`${this.baseUrl}/vocabulary/translation`,{"input":word, "to":"en", "from":"de"})
      .pipe(map((response) => {
        let contextResultsList = response?.contextResults.results.slice(0,5).map((context:any) => {
          context.sourceExamples = context.sourceExamples.slice(0,5);
          context.targetExamples = context.targetExamples.slice(0,5);
          return context
        });
        return {contextResults: contextResultsList, input: response.input[0], translation: response.translation[0]};
      }))
    }),
    shareReplay(1),
  )
}
