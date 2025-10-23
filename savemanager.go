package main

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
)

type SaveManager struct {
	dataDir string
}

func NewSaveManager() *SaveManager {
	homeDir, _ := os.UserHomeDir()
	dataDir := filepath.Join(homeDir, ".valley-legend", "data")
	err := os.MkdirAll(dataDir, 0755)
	if err != nil {
		return nil
	}
	return &SaveManager{dataDir: dataDir}
}

func (s *SaveManager) SaveGame(saveName string, saveData string) error {
	filename := filepath.Join(s.dataDir, saveName+".json")
	return ioutil.WriteFile(filename, []byte(saveData), 0644)
}

func (s *SaveManager) LoadGame(saveName string) (string, error) {
	filename := filepath.Join(s.dataDir, saveName+".json")
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (s *SaveManager) GetAllSaves() ([]string, error) {
	files, err := ioutil.ReadDir(s.dataDir)
	if err != nil {
		return []string{}, nil
	}
	var saves []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".json") {
			saves = append(saves, strings.TrimSuffix(file.Name(), ".json"))
		}
	}
	return saves, nil
}

func (s *SaveManager) SetLastSave(saveName string) error {
	filename := filepath.Join(s.dataDir, ".last_save")
	return ioutil.WriteFile(filename, []byte(saveName), 0644)
}

func (s *SaveManager) GetLastSave() (string, error) {
	filename := filepath.Join(s.dataDir, ".last_save")
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return "", nil
	}
	return string(data), nil
}

func (s *SaveManager) DeleteSave(saveName string) error {
	filename := filepath.Join(s.dataDir, saveName+".json")
	return os.Remove(filename)
}
